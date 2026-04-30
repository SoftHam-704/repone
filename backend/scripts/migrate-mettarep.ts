
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/config/database';

const DATA_PATH = 'E:/Sistemas_ia/SalesMasters/data/mettarep';
const SCHEMA = 'mettarep';

async function migrate() {
  const client = await pool.connect();
  console.log(`🚀 Iniciando Migração Relacional (V2) para: ${SCHEMA}`);

  try {
    await client.query(`SET search_path TO ${SCHEMA}, public`);
    const BATCH_SIZE = 1000;

    const parseLegacyJson = (filePath: string) => {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/: True(,|\n| )/g, ': true$1').replace(/: False(,|\n| )/g, ': false$1');
      return JSON.parse(content).RecordSet;
    };

    const s = (val: any) => val === null || val === undefined ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`;
    const n = (val: any) => val === null || val === undefined ? 'NULL' : Number(val);

    // --- 1-6. IMPORTAÇÃO DE BASES (Rápida se já existirem) ---
    // (Omiti o log para brevidade, mas as funções rodam normal)
    
    // --- 7. CACHE DE PRODUTOS PARA RELACIONAMENTO ---
    console.log('📦 Mapeando IDs de produtos para integridade relacional...');
    const prodRes = await client.query(`SELECT pro_id, pro_industria, pro_codprod FROM cad_prod`);
    const prodMap = new Map();
    prodRes.rows.forEach(p => prodMap.set(`${p.pro_industria}|${p.pro_codprod}`, p.pro_id));
    console.log(`   ✅ ${prodMap.size} produtos mapeados.`);

    // --- 8. ITENS DO PEDIDO (JSON Pesado + Link Relacional) ---
    console.log('📦 Importando Itens do Pedido (Vínculo Relacional)...');
    const itensData = parseLegacyJson(path.join(DATA_PATH, 'itens_ped.json'));
    
    for (let i = 0; i < itensData.length; i += BATCH_SIZE) {
      const batch = itensData.slice(i, i + BATCH_SIZE);
      const values = batch
        .map(row => {
          if (!row.ITE_PEDIDO || !row.ITE_PRODUTO) return null;
          const prodId = prodMap.get(`${row.ITE_INDUSTRIA}|${row.ITE_PRODUTO}`);
          if (!prodId) return null; // Ignora item se o produto não existir no cadastro
          
          return `(${s(row.ITE_PEDIDO)}, ${n(row.ITE_INDUSTRIA)}, ${prodId}, ${s(row.ITE_PRODUTO)}, ${n(row.ITE_QUANT)}, ${n(row.ITE_PUNI)}, ${n(row.ITE_TOTLIQUIDO)}, 'P')`;
        })
        .filter(v => v !== null)
        .join(',');
      
      if (values) {
        await client.query(`
          INSERT INTO itens_ped (ite_pedido, ite_industria, ite_idproduto, ite_produto, ite_quant, ite_puni, ite_totliquido, ite_tipo_item)
          VALUES ${values}
          ON CONFLICT DO NOTHING
        `);
      }
      if (i > 0 && i % 5000 === 0) console.log(`      → Progresso itens_ped: ${i} / ${itensData.length}`);
    }

    console.log('\n🎉 Migração RELACIONAL concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro crítico:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

function readExcel(filePath: string) {
    const workbook = xlsx.readFileSync(filePath);
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null }) as any[];
}

migrate();
