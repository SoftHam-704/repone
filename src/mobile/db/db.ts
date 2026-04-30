import Dexie, { type Table } from 'dexie';
import type { MobileClient, MobileProduct, MobilePrice, MobileOrder, QueuedOrder } from './types';

export class RepOneDB extends Dexie {
  clients!:  Table<MobileClient>;
  products!: Table<MobileProduct>;
  prices!:   Table<MobilePrice>;
  orders!:   Table<MobileOrder>;
  queue!:    Table<QueuedOrder>;

  constructor() {
    super('RepOneDB');
    this.version(1).stores({
      clients:  'cli_codigo',
      products: '[pro_codprod+pro_industria], pro_codprod, pro_industria, pro_nome',
      prices:   '[pro_codprod+tabela_id], pro_codprod, industria_id',
      orders:   'id',
      queue:    '++id, status',
    });
  }
}

export const db = new RepOneDB();
