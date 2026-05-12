import { Request, Response } from 'express';
import { callAI, callAIVision, AIMessage } from '../../shared/utils/ai_providers';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

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
- "codigo": código do produto exatamente como aparece no documento (ex: 6969-0, 8121-5)
- "quantidade": número (use ponto como decimal)
- "preco": preço unitário se disponível, ou null
- "descricao": descrição/nome do produto se disponível, ou null
- Se um campo não existir, use null
- Extraia TODOS os itens, sem pular nenhum
- Não invente dados — use apenas o que está no documento
- O documento pode estar em formato HTML com tabelas (<table><tr><td>) — nesse caso cada linha da tabela é um item
- A primeira coluna costuma ser o código do produto e a segunda a quantidade`;

// ─── HTML table parser para .docx (sem IA, sem limite de tokens) ─────────────
// Extrai itens de tabelas simples código/quantidade geradas pelo mammoth
function extractItemsFromHtmlTable(html: string): any[] | null {
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!rowMatches) return null;

  const items: any[] = [];
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (cells.length < 2) continue;

    const codigo    = cells[0];
    const qtyRaw    = cells[1];
    const priceRaw  = cells[2] ?? null;

    // Aceita padrões: 6969-0, 8121-5, ABC-123, etc.
    if (!/^[\w][\w\d]*[-–][\w\d]+$/.test(codigo)) continue;

    const quantidade = parseFloat(qtyRaw.replace(',', '.'));
    if (isNaN(quantidade) || quantidade <= 0) continue;

    const preco = priceRaw
      ? (parseFloat(priceRaw.replace(/[R$\s.]/g, '').replace(',', '.')) || null)
      : null;

    items.push({ codigo, quantidade, preco, descricao: null });
  }

  return items.length > 0 ? items : null;
}

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

async function extractItemsFromText(text: string, prompt: string): Promise<any[]> {
  const raw = await callAI([
    { role: 'system', content: prompt },
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

async function extractItemsFromVision(base64: string, mimeType: string, prompt: string): Promise<any[]> {
  const raw = await callAIVision({
    prompt,
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

  const name         = file.originalname.toLowerCase();
  const buf          = file.buffer as Buffer;
  const instructions = String((req as any).body?.instructions || '').trim();

  const systemPrompt = instructions
    ? `${SYSTEM_PROMPT}\n\nInstruções adicionais do usuário:\n${instructions}`
    : SYSTEM_PROMPT;

  try {
    let items: any[] = [];

    // ── Excel / CSV ──────────────────────────────────────────────────────────
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const text = excelToText(buf);
      if (!text.trim()) { res.json({ success: true, items: [] }); return; }
      items = await extractItemsFromText(text, systemPrompt);
    }

    // ── Word (.docx) ─────────────────────────────────────────────────────────
    else if (name.endsWith('.docx')) {
      const result = await mammoth.convertToHtml({ buffer: buf });
      const html   = result.value;
      if (!html.trim()) { res.json({ success: true, items: [] }); return; }

      // Se há instruções customizadas, manda direto para IA (ignora parser rígido)
      const parsed = instructions ? null : extractItemsFromHtmlTable(html);
      if (parsed && parsed.length > 0) {
        console.log(`✅ [SMART-ORDER] .docx parsing direto: ${parsed.length} item(s)`);
        items = parsed;
      } else {
        console.log('[SMART-ORDER] .docx enviando para IA');
        items = await extractItemsFromText(html.slice(0, 15000), systemPrompt);
      }
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    else if (name.endsWith('.pdf')) {
      const base64 = buf.toString('base64');
      items = await extractItemsFromVision(base64, 'application/pdf', systemPrompt);
    }

    // ── Image ─────────────────────────────────────────────────────────────────
    else if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) {
      const base64   = buf.toString('base64');
      const ext      = name.split('.').pop()!;
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      items = await extractItemsFromVision(base64, mimeType, systemPrompt);
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
