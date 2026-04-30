import { Request, Response } from 'express';
import { pool } from '../../config/database';

// ─── Menu items definition for V2 ────────────────────────────────────────────
const DEFAULT_MENU_ITEMS = [
  { idx: 10,  label: 'CADASTROS',              isParent: true  },
  { idx: 100, label: 'Clientes'                               },
  { idx: 101, label: 'Indústrias'                             },
  { idx: 102, label: 'Vendedores'                             },
  { idx: 103, label: 'Grupos de Produtos'                     },
  { idx: 104, label: 'Grupos de Descontos'                    },
  { idx: 105, label: 'Regiões'                                },
  { idx: 106, label: 'Setores / Bairros'                      },
  { idx: 107, label: 'Itinerários de Visita'                  },
  { idx: 108, label: 'Área de Atuação'                        },
  { idx: 109, label: 'Transportadoras'                        },
  { idx: 110, label: 'Config. Tabelas de Preços'              },
  { idx: 20,  label: 'MOVIMENTAÇÕES',           isParent: true },
  { idx: 200, label: 'Pedidos de Venda'                       },
  { idx: 201, label: 'Importador Simplificado'                },
  { idx: 202, label: 'Baixa via XML'                          },
  { idx: 203, label: 'Sell-Out'                               },
  { idx: 30,  label: 'PRODUTOS',                isParent: true },
  { idx: 300, label: 'Tabela de Preços'                       },
  { idx: 301, label: 'Importação de Preços'                   },
  { idx: 302, label: 'Catálogo Digital'                       },
  { idx: 40,  label: 'BI / ANÁLISES',           isParent: true },
  { idx: 400, label: 'BI Intelligence'                        },
  { idx: 401, label: 'Metas'                                  },
  { idx: 50,  label: 'UTILITÁRIOS',             isParent: true },
  { idx: 500, label: 'Usuários do Sistema'                    },
  { idx: 501, label: 'Parâmetros'                             },
  { idx: 502, label: 'Configurações'                          },
];

// ─── GROUPS ──────────────────────────────────────────────────────────────────

export async function listGroupsHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    let result;
    try {
      result = await db.query(
        `SELECT grupo, descricao,
                (SELECT COUNT(*) FROM user_nomes WHERE grupo = g.grupo) AS total_usuarios
         FROM user_grupos g
         ORDER BY descricao`
      );
    } catch {
      // user_grupos pode não existir — retorna vazio
      result = { rows: [] };
    }
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [USERS] list-groups:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createGroupHandler(req: Request, res: Response): Promise<void> {
  try {
    const { grupo, descricao } = req.body;
    const db = req.db!;

    if (!grupo?.trim() || !descricao?.trim()) {
      res.status(400).json({ success: false, message: 'Código e descrição são obrigatórios.' });
      return;
    }

    const code = grupo.trim().toUpperCase().substring(0, 6);
    await db.query(
      `INSERT INTO user_grupos (grupo, descricao) VALUES ($1, $2)`,
      [code, descricao.trim().substring(0, 30)]
    );
    res.json({ success: true, message: 'Grupo criado.', grupo: code });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ success: false, message: 'Já existe um grupo com este código.' });
      return;
    }
    console.error('❌ [USERS] create-group:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateGroupHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { descricao } = req.body;
    const db = req.db!;

    if (!descricao?.trim()) {
      res.status(400).json({ success: false, message: 'Descrição é obrigatória.' });
      return;
    }

    const result = await db.query(
      `UPDATE user_grupos SET descricao = $1 WHERE grupo = $2 RETURNING grupo`,
      [descricao.trim().substring(0, 30), id]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Grupo não encontrado.' });
      return;
    }
    res.json({ success: true, message: 'Grupo atualizado.' });
  } catch (error: any) {
    console.error('❌ [USERS] update-group:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteGroupHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query('BEGIN');

    const users = await client.query(
      `SELECT COUNT(*) AS total FROM user_nomes WHERE grupo = $1`, [id]
    );
    if (parseInt(users.rows[0].total) > 0) {
      res.status(400).json({ success: false, message: 'Grupo possui usuários vinculados — não é possível excluir.' });
      await client.query('ROLLBACK');
      return;
    }

    await client.query(`DELETE FROM user_menu_superior WHERE grupo = $1`, [id]);
    const result = await client.query(`DELETE FROM user_grupos WHERE grupo = $1 RETURNING grupo`, [id]);
    await client.query('COMMIT');

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Grupo não encontrado.' });
      return;
    }
    res.json({ success: true, message: 'Grupo excluído.' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [USERS] delete-group:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
}

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────

export async function getGroupPermissionsHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    const { groupId } = req.params;
    await client.query(`SET search_path TO ${schema}, public`);

    let result = await client.query(
      `SELECT opcao, grupo, indice, porsenha, invisivel, incluir, modificar, excluir, descricao
       FROM user_menu_superior WHERE grupo = $1 ORDER BY indice`,
      [groupId]
    );

    // Auto-seed with defaults if empty
    if (result.rows.length === 0) {
      const insert = `INSERT INTO user_menu_superior
        (grupo, indice, descricao, opcao, invisivel, incluir, modificar, excluir, porsenha)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

      for (const item of DEFAULT_MENU_ITEMS) {
        await client.query(insert, [
          groupId, item.idx, item.label.toUpperCase(), item.idx,
          false, true, true, true, false,
        ]);
      }

      result = await client.query(
        `SELECT opcao, grupo, indice, porsenha, invisivel, incluir, modificar, excluir, descricao
         FROM user_menu_superior WHERE grupo = $1 ORDER BY indice`,
        [groupId]
      );
    }

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('❌ [USERS] permissions-get:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
}

export async function saveGroupPermissionsHandler(req: Request, res: Response): Promise<void> {
  const schema = req.schema!;
  const client = await pool.connect();
  try {
    const { groupId } = req.params;
    const { permissions } = req.body as { permissions: any[] };

    await client.query(`SET search_path TO ${schema}, public`);
    await client.query('BEGIN');

    for (const perm of permissions) {
      await client.query(
        `UPDATE user_menu_superior
         SET invisivel = $1, incluir = $2, modificar = $3, excluir = $4
         WHERE grupo = $5 AND indice = $6`,
        [!!perm.invisivel, !!perm.incluir, !!perm.modificar, !!perm.excluir, groupId, perm.indice]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Permissões salvas.' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [USERS] permissions-save:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
}

// ─── USERS ───────────────────────────────────────────────────────────────────

// Normaliza boolean/char 'S'/'N'/true/false → boolean
function toBool(v: any, defaultVal = false): boolean {
  if (v === null || v === undefined) return defaultVal;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toUpperCase();
  return s === 'S' || s === 'TRUE' || s === '1' || s === 'T' || s === 'Y';
}

export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = req.db!;
    // Seleciona sem COALESCE de tipo para evitar erro de tipo mismatch (boolean vs char)
    const result = await db.query(
      `SELECT codigo, nome, sobrenome, usuario, grupo, master, gerencia, imagem
       FROM user_nomes
       ORDER BY nome, sobrenome`
    );
    // Normaliza campos que podem ser boolean OU 'S'/'N' dependendo do schema
    const data = result.rows.map((r: any) => ({
      ...r,
      master:   toBool(r.master),
      gerencia: toBool(r.gerencia),
      ativo:    true, // campo ativo pode não existir — assume ativo por padrão
    }));
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ [USERS] list-users:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const { nome, sobrenome, usuario, senha, grupo, master, gerencia, ativo } = req.body;
    const db = req.db!;

    if (!nome?.trim() || !sobrenome?.trim() || !usuario?.trim() || !senha?.trim()) {
      res.status(400).json({ success: false, message: 'Nome, sobrenome, usuário e senha são obrigatórios.' });
      return;
    }

    // Check duplicate username
    const dup = await db.query(`SELECT 1 FROM user_nomes WHERE LOWER(usuario) = LOWER($1)`, [usuario.trim()]);
    if (dup.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Já existe um usuário com este nome de acesso.' });
      return;
    }

    const result = await db.query(
      `INSERT INTO user_nomes (nome, sobrenome, usuario, senha, grupo, master, gerencia)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING codigo`,
      [
        nome.trim(), sobrenome.trim(), usuario.trim(), senha,
        grupo || null,
        toBool(master),
        toBool(gerencia),
      ]
    );

    res.json({ success: true, message: 'Usuário criado.', codigo: result.rows[0].codigo });
  } catch (error: any) {
    console.error('❌ [USERS] create-user:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { nome, sobrenome, usuario, senha, grupo, master, gerencia, ativo } = req.body as Record<string, string>;
    const db = req.db!;

    if (!nome?.trim() || !sobrenome?.trim() || !usuario?.trim()) {
      res.status(400).json({ success: false, message: 'Nome, sobrenome e usuário são obrigatórios.' });
      return;
    }

    // Check duplicate username (excluding self)
    const dup = await db.query(
      `SELECT 1 FROM user_nomes WHERE LOWER(usuario) = LOWER($1) AND codigo <> $2`,
      [usuario.trim(), parseInt(id)]
    );
    if (dup.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Já existe um usuário com este nome de acesso.' });
      return;
    }

    if (senha?.trim()) {
      await db.query(
        `UPDATE user_nomes
         SET nome = $1, sobrenome = $2, usuario = $3, senha = $4,
             grupo = $5, master = $6, gerencia = $7
         WHERE codigo = $8`,
        [
          nome.trim(), sobrenome.trim(), usuario.trim(), senha,
          grupo || null, toBool(master), toBool(gerencia),
          parseInt(id),
        ]
      );
    } else {
      await db.query(
        `UPDATE user_nomes
         SET nome = $1, sobrenome = $2, usuario = $3,
             grupo = $4, master = $5, gerencia = $6
         WHERE codigo = $7`,
        [
          nome.trim(), sobrenome.trim(), usuario.trim(),
          grupo || null, toBool(master), toBool(gerencia),
          parseInt(id),
        ]
      );
    }

    res.json({ success: true, message: 'Usuário atualizado.' });
  } catch (error: any) {
    console.error('❌ [USERS] update-user:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    const db = req.db!;

    if (parseInt(id) === userId) {
      res.status(400).json({ success: false, message: 'Você não pode excluir seu próprio usuário.' });
      return;
    }

    const result = await db.query(
      `DELETE FROM user_nomes WHERE codigo = $1 RETURNING codigo`,
      [parseInt(id)]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      return;
    }
    res.json({ success: true, message: 'Usuário excluído.' });
  } catch (error: any) {
    console.error('❌ [USERS] delete-user:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}
