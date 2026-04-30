import { db } from './db';
import { api } from '@/shared/lib/api';
import { toast } from 'sonner';
import type { MobileClient, MobileProduct, MobilePrice, MobileOrder } from './types';

export async function downloadClientes(): Promise<void> {
  const r = await api.get('/clients?limit=5000');
  const rows: MobileClient[] = (r.data.data || []).map((c: any) => {
    const days = typeof c.dias_sem_compra === 'number' ? c.dias_sem_compra : 999;
    const risk: MobileClient['risk'] =
      days <= 30 ? 'ativo' : days <= 60 ? 'em_queda' : 'burnout';
    return {
      cli_codigo: Number(c.cli_codigo),
      cli_nomred: c.cli_nomred || c.cli_nome || '',
      cli_cidade: c.cli_cidade || '',
      cli_uf:     c.cli_uf    || '',
      cli_email:  c.cli_email || '',
      risk,
    };
  });
  await db.clients.clear();
  await db.clients.bulkPut(rows);
}

export async function downloadOrders(): Promise<void> {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const dtInicio = start.toISOString().split('T')[0];
  const r = await api.get(`/orders?dataInicio=${dtInicio}&limit=1000`);
  const rows: MobileOrder[] = (r.data.data || [])
    .filter((o: any) => o.ped_situacao !== 'E')
    .map((o: any) => ({
      id:            Number(o.ped_numero),
      ped_numero:    Number(o.ped_numero),
      cliente_nome:  o.cli_nomred  || o.cli_nome || '',
      industria_nome: o.for_nomered || '',
      valor_total:   parseFloat(o.total_geral || o.ped_total || '0'),
      data_pedido:   o.ped_data || '',
      situacao:      o.ped_situacao || '',
    }));
  await db.orders.clear();
  await db.orders.bulkPut(rows);
}

export async function downloadProducts(
  onProgress?: (pct: number) => void
): Promise<void> {
  const rInd = await api.get('/aux/industrias');
  const industrias: Array<{ for_codigo: number; for_nomered: string }> =
    rInd.data.data || [];
  const total = industrias.length;
  if (total === 0) return;

  await db.products.clear();
  await db.prices.clear();

  for (let i = 0; i < industrias.length; i++) {
    const ind = industrias[i];
    try {
      const r = await api.get(`/products/${ind.for_codigo}`);
      const items: any[] = r.data.data || [];

      const prodRows: MobileProduct[] = items.map((p: any) => ({
        pro_codprod:   String(p.pro_codprod),
        pro_nome:      p.pro_nome || '',
        pro_industria: Number(ind.for_codigo),
        unidade:       p.pro_undven || p.unidade || 'UN',
      }));

      const priceRows: MobilePrice[] = items
        .filter((p: any) => p.preco != null)
        .map((p: any) => ({
          pro_codprod:  String(p.pro_codprod),
          tabela_id:    Number(p.tabela_id ?? 0),
          preco:        parseFloat(p.preco),
          industria_id: Number(ind.for_codigo),
        }));

      await db.products.bulkPut(prodRows);
      await db.prices.bulkPut(priceRows);
    } catch {
      // skip industry on error, continue with next
    }
    if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
  }
}

export async function autoSync(): Promise<void> {
  try {
    await downloadClientes();
    await downloadOrders();
    localStorage.setItem('repone_last_sync', new Date().toISOString());
  } catch {
    // silent — don't block UI
  }
}

export async function fieldSync(
  onProgress?: (pct: number) => void
): Promise<void> {
  await downloadClientes();
  await downloadOrders();
  await downloadProducts(onProgress);
  localStorage.setItem('repone_last_sync', new Date().toISOString());
}

export async function uploadQueue(): Promise<void> {
  const pending = await db.queue.where('status').equals('pendente').toArray();
  for (const item of pending) {
    try {
      const r = await api.post('/orders', item.payload);
      const num = r.data.data?.ped_numero ?? r.data.data?.id ?? '';
      await db.queue.delete(item.id!);
      toast.success(`Pedido${num ? ` #${num}` : ''} enviado com sucesso`);
    } catch {
      await db.queue.update(item.id!, { status: 'erro' });
    }
  }
}
