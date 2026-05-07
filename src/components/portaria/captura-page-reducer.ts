/**
 * State machine da CapturaPage (story 3.6).
 *
 * Estados:
 *   - idle: aguardando foto
 *   - photo_taken: foto capturada (com ou sem código de rastreio)
 *   - submitting: POST /api/pacotes em curso
 *   - error: falha no submit; foto + código preservados pra retry
 *
 * Transições válidas: ver `capturaReducer` abaixo.
 *
 * Extraído como módulo puro (sem React) pra ter cobertura de teste sem JSDOM.
 */

export interface CapturedPhoto {
  blob: Blob;
  dataUrl: string;
  sizeKb: number;
}

export type CapturaState =
  | { kind: 'idle'; codigo: string }
  | { kind: 'photo_taken'; photo: CapturedPhoto; codigo: string }
  | { kind: 'submitting'; photo: CapturedPhoto; codigo: string }
  | {
      kind: 'error';
      photo: CapturedPhoto;
      codigo: string;
      message: string;
    };

export type CapturaAction =
  | { type: 'photo_captured'; photo: CapturedPhoto }
  | { type: 'photo_cleared' }
  | { type: 'codigo_changed'; codigo: string }
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string };

export const initialCapturaState: CapturaState = { kind: 'idle', codigo: '' };

export function capturaReducer(state: CapturaState, action: CapturaAction): CapturaState {
  switch (action.type) {
    case 'photo_captured':
      // Aceita em idle, photo_taken (substituir foto) ou error (após "tirar outra")
      if (state.kind === 'submitting') return state;
      return { kind: 'photo_taken', photo: action.photo, codigo: state.codigo };

    case 'photo_cleared':
      // Volta para idle preservando código digitado
      if (state.kind === 'submitting') return state;
      return { kind: 'idle', codigo: state.codigo };

    case 'codigo_changed':
      if (state.kind === 'submitting') return state;
      return { ...state, codigo: action.codigo };

    case 'submit_started':
      // Só faz sentido sair de photo_taken ou error
      if (state.kind !== 'photo_taken' && state.kind !== 'error') return state;
      return { kind: 'submitting', photo: state.photo, codigo: state.codigo };

    case 'submit_failed':
      // Só de submitting → error (preserva foto + código)
      if (state.kind !== 'submitting') return state;
      return {
        kind: 'error',
        photo: state.photo,
        codigo: state.codigo,
        message: action.message,
      };

    default:
      return state;
  }
}

// Aceita qualquer ASCII imprimível exceto `<` e `>` (defesa XSS;
// SQL injection já é prevenido por Prisma parameterized queries).
// QR Codes do mundo real contêm JSON, URLs, etc — regex restritiva quebra uso real.
const CODIGO_REGEX = /^[\x20-\x7E]+$/;
const CODIGO_MAX = 200;

export function isCodigoValid(codigo: string): boolean {
  const trimmed = codigo.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > CODIGO_MAX) return false;
  if (trimmed.includes('<') || trimmed.includes('>')) return false;
  return CODIGO_REGEX.test(trimmed);
}
