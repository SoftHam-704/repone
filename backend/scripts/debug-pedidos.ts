
import { pool } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

const DATA_PATH = 'E:/Sistemas_ia/SalesMasters/data/mettarep';
const SCHEMA = 'mettarep';

async function testPedidos() {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${SCHEMA}, public`);
    
    let content = fs.readFileSync(path.join(DATA_PATH, 'pedidos.json'), 'utf8');
    content = content.replace(/: True(,|\n| )/g, ': true$1').replace(/: False(,|\n| )/g, ': false$1');
    const pedData = JSON.parse(content).RecordSet;

    console.log(`🔍 Testando 5 primeiros pedidos (Total: ${pedData.length})`);
    
    for (let i = 0; i < 5; i++) {
        const r = pedData[i];
        console.log(`   → Inserindo pedido: ${r.PED_PEDIDO}`);
        try {
            await client.query(`
                INSERT INTO pedidos (ped_pedido, ped_data, ped_industria, ped_cliente, ped_vendedor, ped_situacao, ped_totliq)
                VALUES ($1, to_date($2, 'DD.MM.YYYY'), $3, $4, $5, $6, $7)
            `, [r.PED_PEDIDO, r.PED_DATA, r.PED_INDUSTRIA, r.PED_CLIENTE, r.PED_VENDEDOR, r.PED_SITUACAO ? String(r.PED_SITUACAO).charAt(0) : 'P', r.PED_TOTLIQ || 0]);
            console.log(`     ✅ OK`);
        } catch (e: any) {
            console.error(`     ❌ ERRO:`, e.detail || e.message);
        }
    }
  } finally {
    client.release();
    process.exit(0);
  }
}
testPedidos();
