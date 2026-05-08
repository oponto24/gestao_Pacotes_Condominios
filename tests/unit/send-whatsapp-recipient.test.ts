/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { __testing__ } from '@/lib/queue/jobs/send-whatsapp';

const { chooseRecipientSimple } = __testing__;

describe('chooseRecipientSimple (lógica simplificada — substituída por 4.5)', () => {
  it('escolhe principal quando existe e tem telefone', () => {
    const result = chooseRecipientSimple([
      { id: 'a', nome: 'Adicional', telefone: '5511111111111', is_principal: false },
      { id: 'p', nome: 'Principal', telefone: '5599999999999', is_principal: true },
    ]);
    expect(result?.id).toBe('p');
  });

  it('cai no primeiro adicional com telefone se principal sem telefone', () => {
    const result = chooseRecipientSimple([
      { id: 'p', nome: 'Principal', telefone: '', is_principal: true },
      { id: 'a', nome: 'Adicional', telefone: '5511111111111', is_principal: false },
    ]);
    expect(result?.id).toBe('a');
  });

  it('retorna null quando ninguém tem telefone', () => {
    expect(
      chooseRecipientSimple([
        { id: 'p', nome: 'Principal', telefone: '', is_principal: true },
        { id: 'a', nome: 'Adicional', telefone: '   ', is_principal: false },
      ]),
    ).toBeNull();
  });

  it('retorna null quando lista vazia', () => {
    expect(chooseRecipientSimple([])).toBeNull();
  });
});
