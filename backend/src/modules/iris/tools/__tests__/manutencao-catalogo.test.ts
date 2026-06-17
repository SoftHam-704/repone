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

import { removerItens } from '../remover-itens';

function dbWith(rowsByCall: any[][]) {
  let i = 0;
  const query = vi.fn(async () => ({ rows: rowsByCall[i++] ?? [] }));
  const transaction = vi.fn(async (fn: any) => fn({ query }));
  return { query, transaction };
}
const IND = [{ for_codigo: 7, for_nomered: 'CANAPARTS', for_nome: 'CANA' }];
const MASTER = { role: 'admin' };
const GER = { role: 'manager' };

describe('removerItens', () => {
  it('prévia por padrão "termina em 000" lista os itens e quem tem movimento', async () => {
    const db = dbWith([
      IND,
      [{ pro_id: 1, pro_codprod: 'AL1010000', pro_nome: 'X', pro_status: true },
       { pro_id: 2, pro_codprod: 'AL2020000', pro_nome: 'Y', pro_status: true }],
      [{ ite_idproduto: 1 }],
    ]);
    const r: any = await removerItens(db as any, { industria: 'CANAPARTS', padrao: { modo: 'termina', valor: '000' }, acao: 'excluir' }, GER);
    expect(r.previa).toBe(true);
    expect(r.total).toBe(2);
    expect(r.com_movimento).toBe(1);
  });

  it('excluir exige Master', async () => {
    const db = dbWith([IND, [{ pro_id: 2, pro_codprod: 'AL2020000', pro_nome: 'Y', pro_status: true }], []]);
    const r: any = await removerItens(db as any, { industria: 'CANAPARTS', codigos: ['AL2020000'], acao: 'excluir', confirmar: true }, GER);
    expect(r.erro).toMatch(/Master/i);
  });

  it('excluir (Master) apaga só os sem movimento', async () => {
    const db = dbWith([
      IND,
      [{ pro_id: 1, pro_codprod: 'A000', pro_nome: 'X', pro_status: true },
       { pro_id: 2, pro_codprod: 'B000', pro_nome: 'Y', pro_status: true }],
      [{ ite_idproduto: 1 }],
      [],
    ]);
    const r: any = await removerItens(db as any, { industria: 'CANAPARTS', padrao: { modo: 'termina', valor: '000' }, acao: 'excluir', confirmar: true }, MASTER);
    expect(r.ok).toBe(true);
    expect(r.excluidos).toBe(1);
    expect(r.preservados_com_movimento).toEqual(['A000']);
  });
});
