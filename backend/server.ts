import { env } from './src/config/env';
import './src/config/database'; // Importar para inicializar o pool e verificar conexão
import app from './src/app';
import { startIrisCotacaoCron } from './src/modules/iris/iris-cotacao';

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 SalesMasters V2 API rodando na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env: ${env.NODE_ENV}`);

  // Inicia o cron da IRIS para processar cotações do portal
  startIrisCotacaoCron();
});
