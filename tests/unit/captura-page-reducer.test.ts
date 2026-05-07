import { describe, it, expect } from 'vitest';
import {
  capturaReducer,
  initialCapturaState,
  isCodigoValid,
  type CapturedPhoto,
} from '@/components/portaria/captura-page-reducer';

const fakePhoto: CapturedPhoto = {
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  dataUrl: 'data:image/jpeg;base64,AAA',
  sizeKb: 1,
};

const fakePhoto2: CapturedPhoto = {
  blob: new Blob(['yy'], { type: 'image/jpeg' }),
  dataUrl: 'data:image/jpeg;base64,BBB',
  sizeKb: 2,
};

describe('capturaReducer', () => {
  it('idle → photo_taken via photo_captured', () => {
    const next = capturaReducer(initialCapturaState, {
      type: 'photo_captured',
      photo: fakePhoto,
    });
    expect(next.kind).toBe('photo_taken');
    if (next.kind === 'photo_taken') {
      expect(next.photo).toBe(fakePhoto);
      expect(next.codigo).toBe('');
    }
  });

  it('preserva codigo ao tirar foto', () => {
    const withCodigo = capturaReducer(initialCapturaState, {
      type: 'codigo_changed',
      codigo: 'ABC123',
    });
    const next = capturaReducer(withCodigo, {
      type: 'photo_captured',
      photo: fakePhoto,
    });
    if (next.kind !== 'photo_taken') throw new Error('expected photo_taken');
    expect(next.codigo).toBe('ABC123');
  });

  it('photo_taken → photo_taken substituindo foto', () => {
    const s1 = capturaReducer(initialCapturaState, {
      type: 'photo_captured',
      photo: fakePhoto,
    });
    const s2 = capturaReducer(s1, { type: 'photo_captured', photo: fakePhoto2 });
    if (s2.kind !== 'photo_taken') throw new Error('expected photo_taken');
    expect(s2.photo).toBe(fakePhoto2);
  });

  it('photo_taken → submitting via submit_started', () => {
    const s1 = capturaReducer(initialCapturaState, {
      type: 'photo_captured',
      photo: fakePhoto,
    });
    const s2 = capturaReducer(s1, { type: 'submit_started' });
    expect(s2.kind).toBe('submitting');
  });

  it('submitting → error preserva foto + codigo', () => {
    const s1 = capturaReducer(initialCapturaState, {
      type: 'codigo_changed',
      codigo: 'ML-789',
    });
    const s2 = capturaReducer(s1, { type: 'photo_captured', photo: fakePhoto });
    const s3 = capturaReducer(s2, { type: 'submit_started' });
    const s4 = capturaReducer(s3, { type: 'submit_failed', message: 'rede caiu' });
    if (s4.kind !== 'error') throw new Error('expected error');
    expect(s4.photo).toBe(fakePhoto);
    expect(s4.codigo).toBe('ML-789');
    expect(s4.message).toBe('rede caiu');
  });

  it('error → submitting via retry mantém payload', () => {
    let s = capturaReducer(initialCapturaState, {
      type: 'photo_captured',
      photo: fakePhoto,
    });
    s = capturaReducer(s, { type: 'submit_started' });
    s = capturaReducer(s, { type: 'submit_failed', message: 'x' });
    s = capturaReducer(s, { type: 'submit_started' });
    if (s.kind !== 'submitting') throw new Error('expected submitting');
    expect(s.photo).toBe(fakePhoto);
  });

  it('photo_cleared volta a idle preservando codigo', () => {
    let s = capturaReducer(initialCapturaState, {
      type: 'codigo_changed',
      codigo: 'XYZ',
    });
    s = capturaReducer(s, { type: 'photo_captured', photo: fakePhoto });
    s = capturaReducer(s, { type: 'photo_cleared' });
    expect(s.kind).toBe('idle');
    if (s.kind === 'idle') expect(s.codigo).toBe('XYZ');
  });

  it('submitting é estado terminal pra inputs (não muta)', () => {
    let s = capturaReducer(initialCapturaState, {
      type: 'photo_captured',
      photo: fakePhoto,
    });
    s = capturaReducer(s, { type: 'submit_started' });
    const before = s;
    const after1 = capturaReducer(s, { type: 'codigo_changed', codigo: 'novo' });
    const after2 = capturaReducer(s, {
      type: 'photo_captured',
      photo: fakePhoto2,
    });
    const after3 = capturaReducer(s, { type: 'photo_cleared' });
    expect(after1).toBe(before);
    expect(after2).toBe(before);
    expect(after3).toBe(before);
  });

  it('submit_started ignorado em idle ou submitting', () => {
    const s = capturaReducer(initialCapturaState, { type: 'submit_started' });
    expect(s).toBe(initialCapturaState);
  });
});

describe('isCodigoValid', () => {
  it('aceita vazio', () => {
    expect(isCodigoValid('')).toBe(true);
    expect(isCodigoValid('   ')).toBe(true);
  });

  it('aceita alfanumérico + . - / espaço', () => {
    expect(isCodigoValid('ABC-123/45.x')).toBe(true);
    expect(isCodigoValid('Codigo Com Espaco')).toBe(true);
  });

  it('aceita QR Code com JSON (uso real)', () => {
    expect(isCodigoValid('{"id":"46972841780","t":"lm"}')).toBe(true);
    expect(isCodigoValid('https://wa.me/qr/4C5VTKUCNLZEO1')).toBe(true);
    expect(isCodigoValid('a@b')).toBe(true);
    expect(isCodigoValid("'; DROP TABLE--")).toBe(true);
  });

  it('rejeita < e > (XSS)', () => {
    expect(isCodigoValid('<script>')).toBe(false);
    expect(isCodigoValid('a<b')).toBe(false);
    expect(isCodigoValid('a>b')).toBe(false);
  });

  it('rejeita > 200 chars', () => {
    expect(isCodigoValid('A'.repeat(201))).toBe(false);
    expect(isCodigoValid('A'.repeat(200))).toBe(true);
  });
});
