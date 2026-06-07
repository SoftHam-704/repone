import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ========================
// Middlewares globais
// ========================
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: '10mb' }));

// Módulos
import authRoutes      from './modules/auth/auth.routes';
import auxiliaryRoutes from './modules/auxiliary/auxiliary.routes';
import clientsRoutes   from './modules/clients/clients.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import ordersRoutes    from './modules/orders/orders.routes';
import productsRoutes  from './modules/products/products.routes';
import suppliersRoutes from './modules/suppliers/suppliers.routes';
import sellersRoutes    from './modules/sellers/sellers.routes';
import gruposRoutes          from './modules/grupos/grupos.routes';
import grupoDescRoutes        from './modules/grupo-desc/grupo-desc.routes';
import priceTablesRoutes      from './modules/price-tables/price-tables.routes';
import regioesRoutes          from './modules/regioes/regioes.routes';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { searchCidadesHandler } from './modules/regioes/regioes.controller';
import setoresRoutes          from './modules/setores/setores.routes';
import itinerariosRoutes      from './modules/itinerarios/itinerarios.routes';
import areaAtuacaoRoutes      from './modules/area-atuacao/area-atuacao.routes';
import transportadorasRoutes  from './modules/transportadoras/transportadoras.routes';
import empresaRoutes           from './modules/empresa/empresa.routes';
import parametrosRoutes        from './modules/parametros/parametros.routes';
import emailRoutes             from './modules/email/email.routes';
import orderItemsRoutes        from './modules/order-items/order-items.routes';
import smartOrderRoutes        from './modules/smart-order/smart-order.routes';
import billingRoutes           from './modules/billing/billing.routes';
import portalRoutes            from './modules/portal/portal.routes';
import smartImporterRoutes     from './modules/smart-importer/smart-importer.routes';
import biRoutes                from './modules/bi/bi.routes';
import irisChatRoutes          from './modules/iris/iris-chat.routes';
import noticiasRoutes          from './modules/noticias/noticias.routes';
import campaignsRoutes         from './modules/campaigns/campaigns.routes';
import selloutRoutes           from './modules/sellout/sellout.routes';
import nfeRoutes               from './modules/nfe/nfe.routes';
import usersRoutes              from './modules/users/users.routes';
import agendaRoutes             from './modules/agenda/agenda.routes';
import financeiroRoutes         from './modules/financeiro/financeiro.routes';
import crmRoutes               from './modules/crm/crm.routes';
import aftermarketRoutes       from './modules/aftermarket/aftermarket.routes';
import iaRoutes                from './modules/ia/ia.routes';
import { webhookRouter, whatsappAuthRouter } from './modules/whatsapp/whatsapp.routes';
import emailCentralRoutes from './modules/email-central/email-central.routes';
import estatisticasRoutes from './modules/estatisticas/estatisticas.routes';
import reportsRoutes      from './modules/reports/reports.routes';
import adminRoutes        from './modules/admin/admin.routes';
import trainingRoutes     from './modules/training/training.routes';
import portalPubRoutes   from './modules/portal-pub/portal-pub.routes';
import despesasRoutes       from './modules/despesas/despesas.routes';
import livroCaixaRoutes        from './modules/livro-caixa/livro-caixa.routes';
import nfseRoutes              from './modules/nfse/nfse.routes';

app.use('/api/auth',      authRoutes);
app.use('/api/aux',       auxiliaryRoutes);
app.use('/api/clients',   clientsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders',    ordersRoutes);
app.use('/api/products',  productsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/sellers',   sellersRoutes);
app.use('/api/grupos',          gruposRoutes);
app.use('/api/grupo-desc',      grupoDescRoutes);
app.use('/api/price-tables',    priceTablesRoutes);
app.use('/api/regioes',         regioesRoutes);
app.get('/api/cidades',         authMiddleware, tenantMiddleware, searchCidadesHandler);
app.use('/api/setores',         setoresRoutes);
app.use('/api/itinerarios',     itinerariosRoutes);
app.use('/api/area-atuacao',    areaAtuacaoRoutes);
app.use('/api/transportadoras', transportadorasRoutes);
app.use('/api/empresa',         empresaRoutes);
app.use('/api/parametros',      parametrosRoutes);
app.use('/api/email',           emailRoutes);
app.use('/api/order-items',     orderItemsRoutes);
app.use('/api/smart-order',     smartOrderRoutes);
app.use('/api/billing',         billingRoutes);
app.use('/api/portal',          portalRoutes);
app.use('/api/smart-importer',  smartImporterRoutes);
app.use('/api/bi',              biRoutes);
app.use('/api/iris',            irisChatRoutes);
app.use('/api/noticias',        noticiasRoutes);
app.use('/api/campaigns',       campaignsRoutes);
app.use('/api/sellout',         selloutRoutes);
app.use('/api/nfe',             nfeRoutes);
app.use('/api/users',           usersRoutes);
app.use('/api/agenda',          agendaRoutes);
app.use('/api/financeiro',      financeiroRoutes);
app.use('/api/livro-caixa',     livroCaixaRoutes);
app.use('/api/nfse',            nfseRoutes);
app.use('/api/crm',            crmRoutes);
app.use('/api/aftermarket',    aftermarketRoutes);
app.use('/api/ia',             iaRoutes);
app.use('/api/whatsapp',       whatsappAuthRouter);
app.use('/api/email-central',  emailCentralRoutes);
app.use('/api/estatisticas',   estatisticasRoutes);
app.use('/api/reports',        reportsRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/training',       trainingRoutes);
app.use('/api/portal-pub',     portalPubRoutes);
app.use('/api/despesas',       despesasRoutes);
// Webhook público — sem prefixo /api (Evolution API chama /webhook/evolution)
app.use('/webhook',            webhookRouter);

// ── Manual do Usuário (markdown) ─────────────────────────────────────────────
// Proxy server-side do .md hospedado (sem CORS) — fonte única do leitor online, do
// Assistente de how-to e da IRIS. Atualizar o manual = subir SÓ o .md (sem redeploy).
import { getManualMarkdown } from './shared/utils/manual';
app.get('/api/manual', authMiddleware, async (_req, res) => {
  const text = await getManualMarkdown();
  if (text) { res.type('text/markdown; charset=utf-8').send(text); return; }
  res.status(502).json({ success: false, message: 'Manual indisponível no momento.' });
});

// Alias /api/config/company → compatibilidade com OrderReportEngine/SendEmailDialog
// Retorna no formato que o OrderPdfReport espera: { success, config: { logotipo, nome, ... } }
// O campo logotipo é processado via sharp para garantir data URL válida
import sharp from 'sharp';
app.get('/api/config/company', authMiddleware, tenantMiddleware, async (req: any, res) => {
  try {
    const db = req.db!;
    const result = await db.query(
      `SELECT emp_id, emp_nome AS nome, emp_endereco AS endereco, emp_bairro AS bairro,
              emp_cidade AS cidade, emp_uf AS uf, emp_cep AS cep, emp_cnpj AS cnpj,
              emp_inscricao AS inscricao, emp_fones AS fones, emp_logotipo AS logotipo
       FROM empresa_status WHERE emp_id = 1 LIMIT 1`
    );
    const config = result.rows[0] || null;
    if (config?.logotipo) {
      try {
        let imageBuffer: Buffer | null = null;
        const raw = config.logotipo;
        if (Buffer.isBuffer(raw)) {
          imageBuffer = raw;
        } else if (typeof raw === 'string') {
          const trimmed = raw.trim();
          const cleanBase64 = trimmed.replace(/[\n\r\s]/g, '').replace(/^data:image\/[a-z+]+;base64,/, '');
          if (/^[A-Za-z0-9+/=]+$/.test(cleanBase64) && cleanBase64.length >= 20) {
            imageBuffer = Buffer.from(cleanBase64, 'base64');
          }
        } else if (raw && typeof raw === 'object' && raw.type === 'Buffer' && Array.isArray(raw.data)) {
          imageBuffer = Buffer.from(raw.data);
        }
        if (imageBuffer) {
          const resized = await sharp(imageBuffer)
            .resize({ width: 300, height: 150, fit: 'inside', withoutEnlargement: true })
            .toFormat('jpeg', { quality: 80 })
            .toBuffer();
          config.logotipo = `data:image/jpeg;base64,${resized.toString('base64')}`;
        } else {
          config.logotipo = null;
        }
      } catch {
        config.logotipo = null;
      }
    }
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'SalesMasters V2 API',
    version: '2.0.0',
    env: env.NODE_ENV,
  });
});

// ========================
// Static frontend (serve se a pasta existir)
// ========================
const frontendPath = path.resolve(__dirname, '../../../frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ========================
// Handler global de erros (sempre por último)
// ========================
app.use(errorHandler);

export default app;
