import { describe, it, expect, vi } from 'vitest';
import { normCod, resolverIndustria, temMovimentoMap } from '../catalogo-shared';

describe('normCod', () => {
  it('tira máscara e caixa', () => {
    expect(normCod('al-1010')).toBe('AL1010');
    expect(normCod(' 01.00126 ')).toBe('0100126');
  });
});

describe('resolverIndustria', () => {
  it('acha exata pelo nome reduzido', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ for_codigo: 7, for_nomered: 'CANAPARTS', for_nome: 'CANA' }] }) };
    const r = await resolverIndustria(db as any, 'CANAPARTS');
    expect(r.ok).toBe(true);
    expect((r as any).industria.for_codigo).toBe(7);
  });
  it('não achou → pede de novo', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const r = await resolverIndustria(db as any, 'XPTO');
    expect(r.ok).toBe(false);
  });
});

describe('temMovimentoMap', () => {
  it('marca quais pro_id têm pedido', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ ite_idproduto: 10 }] }) };
    const m = await temMovimentoMap(db as any, [10, 20]);
    expect(m.get(10)).toBe(true);
    expect(m.get(20)).toBe(false);
  });
});
