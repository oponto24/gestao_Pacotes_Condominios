import { describe, it, expect } from 'vitest';
import { parseImportCsv, MAX_ROWS } from '@/lib/csv/parse-import';

const HEADER = 'bloco,identificador,morador_nome,morador_telefone,morador_email';

describe('parseImportCsv', () => {
  it('aceita CSV mínimo válido', () => {
    const csv = `${HEADER}\nA,101,João Silva,(11) 98765-4321,joao@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(1);
    expect(out.invalid).toHaveLength(0);
    expect(out.valid[0].morador_telefone).toBe('+5511987654321');
    expect(out.valid[0].linha).toBe(2);
  });

  it('strip BOM no início', () => {
    const csv = `﻿${HEADER}\nA,101,João Silva,(11) 98765-4321,joao@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(1);
  });

  it('aceita ordem das colunas trocada', () => {
    const csv = `morador_email,morador_nome,morador_telefone,identificador,bloco
joao@test.com,João Silva,(11) 98765-4321,101,A`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(1);
    expect(out.valid[0].bloco).toBe('A');
  });

  it('detecta cabeçalho ausente (arquivo vazio)', () => {
    const out = parseImportCsv('');
    expect(out.kind).toBe('fatal');
    if (out.kind !== 'fatal') return;
    expect(out.code).toBe('MISSING_HEADER');
  });

  it('detecta colunas faltando e lista quais', () => {
    const csv = 'bloco,identificador,morador_nome\nA,101,João';
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('fatal');
    if (out.kind !== 'fatal') return;
    expect(out.code).toBe('MISSING_COLUMN');
    expect(out.details).toContain('morador_telefone');
    expect(out.details).toContain('morador_email');
  });

  it('linhas em branco são ignoradas (não contam como inválidas)', () => {
    const csv = `${HEADER}\nA,101,João Silva,(11) 98765-4321,joao@test.com\n\n\nB,202,Maria,(11) 91111-2222,maria@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(2);
    expect(out.invalid).toHaveLength(0);
  });

  it('aspas duplas escapando vírgula no nome', () => {
    const csv = `${HEADER}\nA,101,"Silva, João",(11) 98765-4321,joao@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(1);
    expect(out.valid[0].morador_nome).toBe('Silva, João');
  });

  it('separa linhas válidas e inválidas mantendo ordem', () => {
    const csv = `${HEADER}
A,101,João Silva,(11) 98765-4321,joao@test.com
B,202,Jo,abc,not-email
C,303,Maria Santos,(11) 91111-2222,`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(2);
    expect(out.invalid).toHaveLength(1);
    expect(out.invalid[0].linha).toBe(3);
    expect(out.invalid[0].errors.length).toBeGreaterThan(1); // múltiplos erros na mesma linha
  });

  it('detecta DUPLICATE_UNIDADE entre 2 linhas', () => {
    const csv = `${HEADER}
A,101,João Silva,(11) 98765-4321,joao@test.com
A,101,Outro Nome,(11) 91111-2222,outro@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(0);
    expect(out.invalid).toHaveLength(2);
    expect(out.invalid[0].errors[0]).toContain('DUPLICATE_UNIDADE');
    expect(out.invalid[1].errors[0]).toContain('DUPLICATE_UNIDADE');
    // ambas linhas referenciam a outra
    expect(out.invalid[0].errors[0]).toContain('3');
    expect(out.invalid[1].errors[0]).toContain('2');
  });

  it('bloco vazio NÃO conflita com bloco preenchido para mesmo identificador', () => {
    const csv = `${HEADER}
,101,João Silva,(11) 98765-4321,joao@test.com
A,101,Outro,(11) 91111-2222,outro@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(2);
    expect(out.invalid).toHaveLength(0);
  });

  it('detecta DUPLICATE_TELEFONE entre linhas', () => {
    const csv = `${HEADER}
A,101,João Silva,(11) 98765-4321,joao@test.com
B,202,Maria,(11) 98765-4321,maria@test.com`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('parsed');
    if (out.kind !== 'parsed') return;
    expect(out.valid).toHaveLength(0);
    expect(out.invalid).toHaveLength(2);
    expect(out.invalid[0].errors[0]).toContain('DUPLICATE_TELEFONE');
  });

  it('TOO_MANY_ROWS quando excede limite', () => {
    const linhas = Array.from(
      { length: MAX_ROWS + 1 },
      (_, i) => `A,${100 + i},Morador ${i},(11) 9${String(i).padStart(8, '0')},test${i}@e.com`,
    );
    const csv = `${HEADER}\n${linhas.join('\n')}`;
    const out = parseImportCsv(csv);
    expect(out.kind).toBe('fatal');
    if (out.kind !== 'fatal') return;
    expect(out.code).toBe('TOO_MANY_ROWS');
    expect(out.details).toContain(String(MAX_ROWS));
  });
});
