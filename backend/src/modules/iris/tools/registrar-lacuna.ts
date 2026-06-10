import { masterPool } from '../../../config/database';

/**
 * registrar_lacuna — grava no MASTER (public.iris_lacunas) toda parede que a
 * IRIS bate: número sem tool, ou rotina/recurso que não existe no sistema.
 *
 * É GLOBAL (nível SoftHam), não do tenant — vira o "Radar de Lacunas" visto no
 * SoftHam-ADM. Guarda o ofício/pedido, nunca dado sensível de ninguém.
 * Idempotência leve: não duplica a MESMA pergunta do MESMO tenant em 24h.
 */
export async function registrarLacuna(_db: any, input: any, user: any) {
  const pergunta = String(input.pergunta || '').trim().slice(0, 2000);
  if (!pergunta) return { registrado: false, erro: 'pergunta vazia' };

  const motivosOk = ['falta_tool', 'rotina_inexistente', 'ambiguo', 'outro'];
  const motivo = motivosOk.includes(input.motivo) ? input.motivo : 'outro';
  const detalhe = input.detalhe ? String(input.detalhe).trim().slice(0, 2000) : null;
  const tenant = (user && user.schema) ? String(user.schema) : null;
  // QUEM pediu — pra equipe SoftHam saber o REP/usuário por trás do recado.
  const usuario = (user && (user.name || user.username)) ? String(user.name || user.username).slice(0, 200) : null;

  try {
    // evita floodar com a mesma pergunta do mesmo tenant no mesmo dia
    const dup = await masterPool.query(
      `SELECT 1 FROM public.iris_lacunas
        WHERE tenant IS NOT DISTINCT FROM $1
          AND lower(pergunta) = lower($2)
          AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1`,
      [tenant, pergunta]
    );
    if (dup.rowCount === 0) {
      try {
        await masterPool.query(
          `INSERT INTO public.iris_lacunas (tenant, usuario, pergunta, motivo, detalhe) VALUES ($1, $2, $3, $4, $5)`,
          [tenant, usuario, pergunta, motivo, detalhe]
        );
      } catch {
        // fallback: coluna `usuario` ainda não criada no master — grava sem ela
        await masterPool.query(
          `INSERT INTO public.iris_lacunas (tenant, pergunta, motivo, detalhe) VALUES ($1, $2, $3, $4)`,
          [tenant, pergunta, motivo, detalhe]
        );
      }
    }
    return { registrado: true, mensagem: 'Anotei essa lacuna pra equipe SoftHam avaliar.' };
  } catch (e: any) {
    // nunca derruba a resposta da IRIS por falha de log
    return { registrado: false, erro: 'não foi possível registrar agora' };
  }
}
