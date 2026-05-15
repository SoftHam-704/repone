import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { mapaVendasHandler, clientInsightHandler, selloutPeriodoHandler, selloutRealHandler, mapaCliIndustriaHandler, clientesYoYHandler, mapaMensalItensHandler, comparativoClientesHandler, grupoLojasHandler, itensNuncaCompradosHandler, mapa3AnosHandler, ultimasComprasHandler, clientesInativosHandler, prodUnicaCompraHandler, vendaMensalIndustriaHandler, mapaPedidosHandler, curvaAbcProdutosHandler, mapaOportunidadesHandler, mapaIndustriaHandler } from './estatisticas.controller';

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
router.get('/clientes-yoy',        clientesYoYHandler);
router.get('/mapa-cli-industria',  mapaCliIndustriaHandler);
router.get('/sellout-periodo',    selloutPeriodoHandler);
router.get('/sellout-real',       selloutRealHandler);
router.get('/mapa-vendas',     mapaVendasHandler);
router.get('/client-insight',        clientInsightHandler);
router.get('/curva-abc-produtos',    curvaAbcProdutosHandler);
router.get('/mapa-oportunidades',    mapaOportunidadesHandler);
router.get('/mapa-industria',        mapaIndustriaHandler);

export default router;
