import { Request, Response } from 'express';
import { callAI, callAIVision, AIMessage } from '../../shared/utils/ai_providers';
import * as XLSX from 'xlsx';

// ─── Extraction prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um especialista em análise de documentos comerciais brasileiros.
Sua tarefa é extrair TODOS os itens/produtos do documento fornecido.

Retorne APENAS um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "items": [
    { "codigo": "ABC123", "quantidade": 10, "preco": 45.90, "descricao": "Nome do produto" },
    ...
  ]
}

Regras:
- "codigo": código do produto exatamente como aparece no documento
- "quantidade": número (use ponto como decimal)
- "preco": preço unitário se disponível, ou null
- "descricao": descrição/nome do produto
- Se um campo não existir, use null
- Extraia TODOS os itens, sem pular nenhum
- Não invente dados — use apenas o que está no documento`;

// ─── Excel → text conversion ──────────────────────────────────────────────────

function excelToText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    rows.forEach((row: any[]) => {
      const line = row.map(c => String(c ?? '').trim()).filter(Boolean).join('\t');
      if (line) lines.push(line);
    });
  });
  return lines.join('\n');
}

// ─── Extraction wrappers ───

async function extractItemsFromText(text: string): Promise<any[]> {
  const raw = await callAI([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: `Documento:\n\n${text.slice(0, 15000)}` }
  ], { responseFormat: 'json_object', modelOpenAI: 'gpt-4o-mini', maxTokens: 8000 });

  console.log('[SMART-ORDER] RAW text response (primeiros 500 chars):', raw?.slice(0, 500));

  try {
    const parsed = JSON.parse(raw);
    console.log('[SMART-ORDER] Parsed items count:', parsed?.items?.length ?? 0);
    return parsed.items || [];
  } catch (e: any) {
    console.error('[SMART-ORDER] Falha ao parsear JSON:', e.message, '| raw:', raw?.slice(0, 200));
    return [];
  }
}

async function extractItemsFromVision(base64: string, mimeType: string): Promise<any[]> {
  const raw = await callAIVision({
    prompt: SYSTEM_PROMPT,
    base64,
    mimeType,
    opts: { responseFormat: 'json_object', maxTokens: 8000 }
  });

  console.log('[SMART-ORDER] RAW vision response (primeiros 500 chars):', raw?.slice(0, 500));

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || '{"items":[]}');
    console.log('[SMART-ORDER] Parsed items count:', parsed?.items?.length ?? 0);
    return parsed.items || [];
  } catch (e: any) {
    console.error('[SMART-ORDER] Falha ao parsear JSON:', e.message, '| raw:', raw?.slice(0, 200));
    return [];
  }
}

// ─── POST /api/smart-order/upload ─────────────────────────────────────────────

export async function smartOrderUploadHandler(req: Request, res: Response): Promise<void> {
  const file = (req as any).file;
  if (!file) { res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' }); return; }

  const name = file.originalname.toLowerCase();
  const buf  = file.buffer as Buffer;

  try {
    let items: any[] = [];

    // ── Excel / CSV ──────────────────────────────────────────────────────────
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const text = excelToText(buf);
      if (!text.trim()) { res.json({ success: true, items: [] }); return; }
      items = await extractItemsFromText(text);
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    else if (name.endsWith('.pdf')) {
      const base64   = buf.toString('base64');
      items = await extractItemsFromVision(base64, 'application/pdf');
    }

    // ── Image ─────────────────────────────────────────────────────────────────
    else if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) {
      const base64   = buf.toString('base64');
      const ext      = name.split('.').pop()!;
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      items = await extractItemsFromVision(base64, mimeType);
    }

    else {
      res.status(400).json({ success: false, message: `Formato não suportado: ${name}` });
      return;
    }

    // Sanitize output
    const sanitized = items
      .filter(it => it?.codigo)
      .map(it => ({
        codigo:     String(it.codigo    || '').trim(),
        quantidade: parseFloat(it.quantidade) || 1,
        preco:      it.preco != null ? (parseFloat(it.preco) || null) : null,
        descricao:  String(it.descricao || '').trim(),
      }));

    console.log(`✅ [SMART-ORDER] ${sanitized.length} item(s) extraído(s) de "${file.originalname}"`);
    res.json({ success: true, items: sanitized });

  } catch (error: any) {
    console.error('❌ [SMART-ORDER] upload:', error.message);
    // Retorna lista vazia em vez de 500 para não quebrar o frontend
    res.json({ success: true, items: [], warning: 'IA indisponível no momento. Verifique as chaves de API no servidor.' });
  }
}
