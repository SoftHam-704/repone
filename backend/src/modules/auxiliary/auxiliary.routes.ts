import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

// GET /api/aux/industrias
router.get('/industrias', async (req: any, res) => {
  try {
    const { search = '', all = '' } = req.query;
    const db = req.db!;
    const skipTypeFilter = all === 'true';

    let query = `
      SELECT
        for_codigo AS value,
        for_nomered AS label,
        for_nomered,
        for_nome,
        for_codigo
      FROM fornecedores
      WHERE 1=1
      ${skipTypeFilter ? '' : "AND (for_tipo2 = 'A' OR for_tipo2 IS NULL)"}
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (for_nome ILIKE $1 OR for_nomered ILIKE $1)`;
    }

    query += ` ORDER BY for_nomered`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [AUX/INDUSTRIAS] Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/aux/vendedores
router.get('/vendedores', async (req: any, res) => {
  try {
    const { search = '' } = req.query;
    const db = req.db!;

    let query = `
      SELECT ven_codigo AS value, ven_nome AS label, ven_codigo, ven_nome
      FROM vendedores
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND ven_nome ILIKE $1`;
    }

    query += ` ORDER BY ven_nome`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [AUX/VENDEDORES] Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/aux/regioes
router.get('/regioes', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT reg_codigo, reg_descricao AS reg_nome FROM regioes ORDER BY reg_descricao`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/regiao-by-cidade/:cidId
router.get('/regiao-by-cidade/:cidId', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT cr.reg_id AS reg_codigo, r.reg_descricao AS reg_nome
       FROM cidades_regioes cr
       INNER JOIN regioes r ON r.reg_codigo = cr.reg_id
       WHERE cr.cid_id = $1
       LIMIT 1`,
      [parseInt(req.params.cidId)]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch {
    res.json({ success: true, data: null });
  }
});

// GET /api/aux/transportadoras
router.get('/transportadoras', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT tra_codigo AS value, tra_nome AS label FROM transportadora ORDER BY tra_nome`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/grupos/:industria
router.get('/grupos/:industria', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT gru_codigo AS value, gru_codigo::text || ' - ' || gru_nome AS label
       FROM grupos
       ORDER BY gru_nome`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/price-tables/:industria?cliente=
// Se cliente informado e tiver cli_ind.cli_tabela, retorna apenas aquela tabela.
// Caso contrário retorna todas as tabelas da indústria.
router.get('/price-tables/:industria', async (req: any, res) => {
  try {
    const { industria } = req.params;
    const cliente = req.query.cliente ? parseInt(String(req.query.cliente)) : null;
    const db = req.db!;
    const indId = parseInt(String(industria));

    if (cliente) {
      const cliRes = await db.query(
        `SELECT cli_tabela FROM cli_ind WHERE cli_codigo = $1 AND cli_forcodigo = $2 LIMIT 1`,
        [cliente, indId]
      );
      if (cliRes.rows.length > 0 && cliRes.rows[0].cli_tabela?.trim()) {
        const t = cliRes.rows[0].cli_tabela.trim();
        res.json({ success: true, data: [{ value: t, label: t }] });
        return;
      }
    }

    const result = await db.query(
      `SELECT DISTINCT itab_tabela AS value, itab_tabela AS label
       FROM cad_tabelaspre
       WHERE itab_idindustria = $1
       ORDER BY itab_tabela`,
      [indId]
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/clientes
router.get('/clientes', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT cli_codigo AS value, COALESCE(cli_nomred, cli_nome) AS label
       FROM clientes
       WHERE cli_nomred IS NOT NULL AND cli_nomred != ''
       ORDER BY cli_nomred
       LIMIT 3000`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/redes-loja
router.get('/redes-loja', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT DISTINCT cli_redeloja AS value, cli_redeloja AS label
       FROM clientes
       WHERE cli_redeloja IS NOT NULL AND cli_redeloja != ''
       ORDER BY cli_redeloja`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/grupo-desc
router.get('/grupo-desc', async (req: any, res) => {
  try {
    const result = await req.db!.query(
      `SELECT gde_id AS value, gde_id::text || ' - ' || COALESCE(gde_nome, '') AS label, gid, gde_nome
       FROM grupo_desc
       ORDER BY gde_id`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// GET /api/aux/cnpj/:cnpj — proxy para BrasilAPI (evita CORS e rate-limit do browser)
router.get('/cnpj/:cnpj', async (req: any, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return res.status(400).json({ success: false, message: 'CNPJ inválido' });

    // Tentativa 1: BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (response.ok) {
      const d: any = await response.json();
      return res.json({ success: true, data: d });
    }

    // Tentativa 2: ReceitaWS
    try {
      const fallback = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, { signal: AbortSignal.timeout(8000) });
      if (fallback.ok) {
        const d: any = await fallback.json();
        if (d.status !== 'ERROR') {
          return res.json({ success: true, data: {
            cnpj, razao_social: d.nome, nome_fantasia: d.fantasia,
            logradouro: d.logradouro, numero: d.numero, complemento: d.complemento,
            bairro: d.bairro, municipio: d.municipio, uf: d.uf,
            cep: d.cep?.replace(/\D/g, ''), email: d.email, data_inicio_atividade: d.abertura,
          }});
        }
      }
    } catch { /* segue para próximo fallback */ }

    // Tentativa 3: cnpj.ws (público, sem rate-limit agressivo)
    try {
      const fallback2 = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { signal: AbortSignal.timeout(8000) });
      if (fallback2.ok) {
        const d: any = await fallback2.json();
        const est = d.estabelecimento || {};
        return res.json({ success: true, data: {
          cnpj, razao_social: d.razao_social, nome_fantasia: d.nome_fantasia || est.nome_fantasia,
          logradouro: est.logradouro, numero: est.numero, complemento: est.complemento,
          bairro: est.bairro, municipio: est.cidade?.nome, uf: est.estado?.sigla,
          cep: (est.cep || '').replace(/\D/g, ''), email: est.email,
          data_inicio_atividade: d.data_inicio_atividade,
        }});
      }
    } catch { /* segue para erro */ }

    return res.status(404).json({ success: false, message: 'CNPJ não encontrado nas bases consultadas.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
