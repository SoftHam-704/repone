import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { mapaVendasHandler, mapaItensClienteHandler, clientInsightHandler, selloutPeriodoHandler, selloutRealHandler, mapaCliIndustriaHandler, clientesYoYHandler, mapaMensalItensHandler, comparativoClientesHandler, grupoLojasHandler, itensNuncaCompradosHandler, mapa3AnosHandler, ultimasComprasHandler, clientesInativosHandler, prodUnicaCompraHandler, vendaMensalIndustriaHandler, mapaPedidosHandler, curvaAbcProdutosHandler, mapaOportunidadesHandler, mapaIndustriaHandler, portfolioIndustriaItensHandler, portfolioIndustriaClientesHandler, vendasPeriodoHandler, clientesChurnTrimestralHandler, gapCatalogoHandler, gapCatalogoClientesHandler, industriasAdormecidasClientesHandler, industriasAdormecidasDetalheHandler, industriasAdormecidasExportHandler} from './estatisticas.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware);

router.get('/venda-mensal-industria', vendaMensalIndustriaHandler);
router.get('/mapa-pedidos',          mapaPedidosHandler);
router.get('/prod-unica-compra',      prodUnicaCompraHandler);
router.get('/clientes-inativos',      clientesInativosHandler);
router.get('/ultimas-compras',        ultimasComprasHandler);
router.get('/mapa-3-anos',           mapa3AnosHandler);
router.get('/itens-nunca-comprados', itensNuncaCompradosHandler);
router.get('/grupo-lojas',          grupoLojasHandler);
router.get('/comparativo-clientes', comparativoClientesHandler);
router.get('/mapa-mensal-itens',   mapaMensalItensHandler);
router.get('/mapa-itens-cliente',  mapaItensClienteHandler);
router.get('/clientes-yoy',        clientesYoYHandler);
router.get('/mapa-cli-industria',  mapaCliIndustriaHandler);
router.get('/sellout-periodo',    selloutPeriodoHandler);
router.get('/sellout-real',       selloutRealHandler);
router.get('/mapa-vendas',     mapaVendasHandler);
router.get('/client-insight',        clientInsightHandler);
router.get('/curva-abc-produtos',    curvaAbcProdutosHandler);
router.get('/mapa-oportunidades',    mapaOportunidadesHandler);
router.get('/mapa-industria',        mapaIndustriaHandler);

// ─── Missões 2026-05-26 ─────────────────────────────────────────────
// Missão 1 — Portfólio por Indústria
router.get('/portfolio-industria/itens',     portfolioIndustriaItensHandler);
router.get('/portfolio-industria/clientes',  portfolioIndustriaClientesHandler);
// Missão 2 — Vendas no Período + Churn Trimestral
router.get('/vendas-periodo',                vendasPeriodoHandler);
router.get('/clientes-churn-trimestral',     clientesChurnTrimestralHandler);
// Missão 3 — Gap de Catálogo (cross-sell ABC)
router.get('/gap-catalogo/clientes',         gapCatalogoClientesHandler);
router.get('/gap-catalogo',                  gapCatalogoHandler);
// 4ª Missão — Indústrias Adormecidas (Fábio/borcatorep)
router.get('/industrias-adormecidas/clientes', industriasAdormecidasClientesHandler);
router.get('/industrias-adormecidas/detalhe',  industriasAdormecidasDetalheHandler);
router.get('/industrias-adormecidas/export',   industriasAdormecidasExportHandler);

export default router;
