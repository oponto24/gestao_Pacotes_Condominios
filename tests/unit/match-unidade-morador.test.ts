import { describe, it, expect } from 'vitest';
import { matchUnidadeMorador } from '@/lib/matching/match-unidade-morador';

const COND_CEP = '74650-100';

const unidades = [
  { id: 'u-1304-3', identificador: '1304', bloco: '3' },
  { id: 'u-101-A', identificador: '101', bloco: 'A' },
  { id: 'u-101-B', identificador: '101', bloco: 'B' },
  { id: 'u-casa5', identificador: 'Casa 5', bloco: null },
];

const moradores = [
  {
    id: 'm-joao',
    unidade_id: 'u-1304-3',
    nome: 'João Silva',
    nome_normalizado: 'joao silva',
    is_principal: true,
  },
  {
    id: 'm-maria',
    unidade_id: 'u-1304-3',
    nome: 'Maria Silva',
    nome_normalizado: 'maria silva',
    is_principal: false,
  },
  {
    id: 'm-101a-principal',
    unidade_id: 'u-101-A',
    nome: 'Pedro Costa',
    nome_normalizado: 'pedro costa',
    is_principal: true,
  },
  {
    id: 'm-casa5-sem-principal',
    unidade_id: 'u-casa5',
    nome: 'Carlos Lima',
    nome_normalizado: 'carlos lima',
    is_principal: false,
  },
];

describe('matchUnidadeMorador', () => {
  it('match perfeito (CEP + apto + bloco + nome)', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: {
        nome_destinatario: 'João Silva',
        cep: '74650-100',
        complemento: 'AP 1304 Bloco 3',
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') {
      expect(r.unidade_id).toBe('u-1304-3');
      expect(r.destinatario_id).toBe('m-joao');
      expect(r.resolvido_via).toBe('destinatario_cadastrado');
      expect(r.flags.cep_diverge).toBe(false);
    }
  });

  it('match com nome sem acento', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: {
        nome_destinatario: 'Joao Silva',
        cep: COND_CEP,
        complemento: 'AP 1304 Bl 3',
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('matched');
  });

  it('fallback principal quando destinatário não está cadastrado', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: {
        nome_destinatario: 'Visitante Desconhecido',
        cep: COND_CEP,
        complemento: 'Apto 101 Bloco A',
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('matched');
    if (r.kind === 'matched') {
      expect(r.resolvido_via).toBe('fallback_principal');
      expect(r.destinatario_id).toBe('m-101a-principal');
    }
  });

  it('pending/no_morador quando unidade existe mas sem principal', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: {
        nome_destinatario: 'Visitante',
        cep: COND_CEP,
        complemento: 'Casa 5',
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') {
      expect(r.reason).toBe('no_morador');
      expect(r.unidade_id).toBe('u-casa5');
    }
  });

  it('pending/ambiguous quando bloco não extraído e há múltiplas unidades', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: {
        nome_destinatario: 'Pedro Costa',
        cep: COND_CEP,
        complemento: 'Apto 101', // sem bloco — duas unidades 101
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') expect(r.reason).toBe('ambiguous_unidade');
  });

  it('pending/no_complemento se IA não extraiu nada', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: { nome_destinatario: null, cep: null, complemento: null },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') expect(r.reason).toBe('no_complemento');
  });

  it('pending/unidade_nao_encontrada se apto não existe', () => {
    const r = matchUnidadeMorador({
      condominio_cep: COND_CEP,
      ia: {
        nome_destinatario: 'João',
        cep: COND_CEP,
        complemento: 'Apto 9999',
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') expect(r.reason).toBe('unidade_nao_encontrada');
  });

  it('cep_diverge flag preserva matching mas marca', () => {
    const r = matchUnidadeMorador({
      condominio_cep: '74650-100',
      ia: {
        nome_destinatario: 'João Silva',
        cep: '01310-100', // CEP diferente
        complemento: 'AP 1304 Bloco 3',
      },
      unidades,
      moradores,
    });
    expect(r.kind).toBe('matched');
    expect(r.flags.cep_diverge).toBe(true);
  });
});
