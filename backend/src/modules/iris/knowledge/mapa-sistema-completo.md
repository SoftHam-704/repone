# Mapa COMPLETO do RepOne — tudo que o sistema tem (inventário, rotina por rotina)

> Use isto para **saber tudo que o sistema oferece** e rotear o REP à tela exata ("isso você faz em **Movimentações → Pedidos**"). Nunca prometa recurso que não está aqui, nunca invente função. Para **número**, sempre tool/relatório (o banco calcula). Caminhos de menu inferidos da navegação — se houver dúvida, ofereça o mais provável.

---

## 1. Comercial — Pedidos de Venda (Movimentações → Pedidos)
- **Listagem** — pedidos por período em cards (cliente/CNPJ, nº, data, indústria, OC, status, valor líquido). Sidebar filtra por indústria (com contador). Filtros: datas, busca cliente/pedido/OC, **combobox de cliente**, situação, ordenação. Abas rápidas Todos/Pedidos/Cotações/WhatsApp. Faixa de stats (Faturamento, Quantidade, PDVs, Ticket, Pedidos, Cotações).
- **Painel de detalhe** — valor total, gráfico 12 meses (faturamento × qtd) do cliente×indústria, curva ABC do cliente na indústria, dados do pedido, últimos pedidos do cliente.
- **Ações do pedido** — Novo (FAB, exige indústria), Visualizar, Editar, **Duplicar/Clonar**, Excluir (soft → status E), Excluir definitivo, **Converter cotação→pedido**, Marcar/Desmarcar Enviado. Menu de contexto (botão direito) com todos os atalhos.
- **Imprimir** — escolhe entre 8+ modelos e ordenação dos itens; abre PDF. **Exportar Excel** do pedido. **Compartilhar WhatsApp** (link do PDF). **Enviar por e-mail** (PDF + Excel opcional, SMTP).
- **Faturar (BillingDialog)** — faturamento por NF: valor, comissão (geral + por vendedor), baixa item-a-item, saldo a faturar, histórico e estorno.
- **IRIS Insights (painel)** — 3 abas: Recomprar (itens sem recompra 30+ dias), Expandir Mix (produtos que o cliente nunca comprou, rankeados), IRIS (análise estratégica: raio-x, oportunidade, alertas, argumentos, frase de abertura). Cria pedido com os selecionados.
- **Consolidação (aba)** — acumula pedidos na fila (status Q) por indústria/cliente, mostra mínimo e meta atingida, **consolida** num pedido de transmissão ou **descarta o carrinho** (Q→P).

### Pedido — Formulário (PedidoModal)
- **Principal (F1)** — situação/fluxo, fornecedor, OC, cliente, transportadora/frete (CIF/FOB), comprador, condição de pagamento, ped-indústria, observação. Cadastrar comprador e tornar política padrão direto daqui.
- **Itens (F3)** — adiciona por código (busca catálogo), aplica descontos do cliente, edita qtd/preço, trata duplicados.
- **Conferência (F5)** — recalcula/sincroniza: Atz. Valores (IPI/ST/nome), Desconto Padrão, Desconto por Grupo, Atz. Tabela, Atz. IPI/ST.
- **Importar itens** — XMS (colar Excel), TXT (lista/arquivo PP2/Stahl/Arca/KV), XML (NF-e), **Magic Load (IA)** (PDF/Excel/Word/imagem → IA extrai itens).

### Portais Industriais (PortalsDialog) & Carrinho em Lote
- **Exportar pedido para portal** — gera arquivo no formato de cada indústria (Stahl, Iguaçu, Viemar, TSA, Sampel, Polo, Borg, Phinia, Ospina, Sinalsul…). PATRAL/ARCA/PARAFLU importam retorno. **FANIA** importa NF-e do portal e gera pedido.
- **Importador Inteligente (Movimentações → Carrinho em Lote)** — Rascunho Rápido (cola lista, IA separa por fábrica em carrinhos), Importar por Arquivo (lote), Checkout (vira pedidos de uma vez).

## 2. Comercial — Produtos, Tabelas & Catálogo (Cadastros/Produtos)
- **Produtos** — lista por indústria+tabela (bruto/promo/especial/líquido, IPI, ST, código normalizado), simulação de descontos, CRUD do produto (identificação, características, linhas leve/pesada/agrícola/etc., preços), sub-abas Vendas e Clientes (histórico de compra).
- **Catálogo Digital** — catálogo por indústria/grupo com badges de linha; editar/excluir (excluir = Master).
- **Tabelas de Preço** — lista por indústria; ajuste linear (%), renomear, atualizar IPI/ST em massa, definir/remover grupo de desconto, limpar preço, ativar/inativar, desativar vencidas (dry-run), exportar Excel, excluir.
- **Importação de Preços** — por colagem (textareas) ou por arquivo (wizard upload→mapeamento→importação, com relatório de inconsistências).

## 3. Portal do Lojista (público — link com token, sem login)
- Acesso por token+schema. Seletor de indústria+período. Abas: **Pedidos** (do lojista no período), **Cotar** (cola lista; atalhos "Repetir meu mix", "Produtos esquecidos", "Explorar catálogo"), **Insights** (descontos, último pedido, dias sem comprar), **ABC** (curva 12 meses), **Recompra** (sugestões), **Tabela de Preços (PDF)**.

## 4. Sell-Out (Movimentações → Sell-Out)
- Registros do que o lojista vendeu ao consumidor (cliente×indústria×período). Cards de stats e tendência, ranking, **pendências** (sem sell-out lançado), novo/editar (soma na mesma combinação), excluir, importar Excel + template.

## 5. Clientes (Cadastros → Clientes)
- **Listagem** — código, CNPJ, nome reduzido, razão, rede, vendedor, cidade/UF, status; busca por nome/CNPJ/cidade; toggle inativos; **Vincular Regiões em lote**; inativar; **histórico** (abas Indústrias e Pedidos).
- **Ficha — abas:** **Geral** (CNPJ com consulta Receita, IE, razão/fantasia/reduzido, rede, status, classificação, COMPRA/NÃO COMPRA, CEP via ViaCEP, endereço, cidade auto-resolve região, telefones, e-mails, cobrança), **Contatos** (CRUD com aniversário → alimenta agenda), **Indústrias** (condições por indústria: transportadora, prazo, tabela, código do cliente, frete, canal varejo/distribuidor, 11 descontos), **Descontos** (por grupo de produto), **Prospecção** (opt-in de indústrias), **Áreas** (opt-in de atuação), **Portal do Lojista** (gera token/link, copiar/WhatsApp).

## 6. CRM (menu CRM)
- **Radar do Rep** — trimestral: visitas na semana, visitas com pedido, clientes em risco (botão ligar), barras de meta por indústria.
- **Carteira** — status ativo/em risco/inativo/perdido, dias sem comprar, última visita, valor do trimestre, LTV; abre Ficha da Carteira (dados, pedidos, visitas, favoritos; registrar visita).
- **Atividades** — follow-ups e interações (abas Pendentes/Histórico; Agendar ou Registrar).
- **Relacionamentos** — timeline por cliente, CRUD de interações, relatório imprimível.
- **Pipeline** — Kanban de oportunidades (Prospecção→Fechamento), drag-and-drop, CRUD com valor/probabilidade.
- **Visitas** — check-in/check-out com GPS (entrada/saída, duração, distância); KPIs; rep vê as próprias, master vê todas.
- **Campo Ao Vivo** — mapa em tempo real das visitas, pinos por resultado, KPIs, ranking de promotores (gestão).
- **Aftermarket** — cadastro de pontos aplicadores (oficinas/auto-elétricas) com funil por estágio, GPS, CEP, porte/segmento.
- **Dashboard CRM** — KPIs de pipeline/follow-ups (rota acessível, não no menu lateral).

## 7. Agenda, Rotas & Territórios
- **Minha Agenda** — tarefas (tarefa/lembrete/visita/ligação/reunião/cobrança/follow-up/aniversário), status, prioridade, vínculo a cliente/pedido, recorrência; visões Lista/Hoje/Kanban; **aniversariantes do mês** (clientes **e contatos de indústrias**); briefing da IRIS.
- **Itinerários de Visita** (Cadastros) — CRUD de roteiros (frequência, vendedor, região), paradas (adicionar clientes, reordenar), **mapa Leaflet** da rota com km.
- **Regiões / Setores / Área de Atuação** (Cadastros) — CRUD de territórios; cidades por região; área de atuação é catálogo fechado (só SoftHam edita).

## 8. Financeiro (Gerência/Master)
- **Dashboard Hub** (Master) — KPIs A Receber/A Pagar/Saldo Previsto/Inadimplência; filtro por ano+meses; **roscas por Centro de Custo**; próximos vencimentos (Pagar × Receber); atalhos Livro Caixa/Fluxo/DRE/NFS-e.
- **Contas a Pagar / a Receber** — lista com filtros (datas, status, fornecedor/cliente, centro, critério vencimento×pagamento); KPIs do período; CRUD com **gerador de parcelas**; detalhe com grade de parcelas + **extrato conta-corrente**; **baixa** (parcial, conta de caixa, juros/desconto, aviso de teto fiscal); **estorno**; lançamento em lote; **relatório PDF/Excel** agrupado por centro/entidade.
- **Plano de Contas** — hierarquia Receita/Despesa (Grupo/Subgrupo/Conta) que alimenta o DRE.
- **Centro de Custo** — CRUD; classifica despesas para DRE/Fluxo.
- **Clientes/Fornecedores Financeiros** — cadastros próprios do financeiro (favorecidos de CR/CP).
- **Livro Caixa** (Master) — extrato em conta-corrente por conta de caixa, saldo corrido, lançamento manual, transferência entre caixas, gestão de contas (caixa/banco/PIX), teto de imposto mensal.
- **Fluxo de Caixa** (Master) — período + agrupamento (diário/semanal/mensal), KPIs entradas/saídas/saldo, gráfico, CSV.
- **DRE Gerencial** (Master) — mês/ano, receitas × despesas por conta, resultado, CSV.
- **NFS-e / Comissões** (Master) — NFS-e às representadas por competência, apuração de impostos (PIS/IRPJ/CSLL/COFINS/ISS/FGTS), matriz de alíquotas, Excel.
- **Despesas de Viagem** — lançamento por categoria (REP vê as próprias, gerência todas), totais, CSV. (cadastro tipicamente no mobile)

## 9. BI Intelligence (Topo → BI) — 9 abas
- **Visão Geral** (faturamento, pedidos, clientes ativos, ticket, crescimento, evolução, drill por indústria), **Indústrias** (comparativo, ranking, roda Top 6), **Clientes** (ranking, inativos, queda MoM, grupos, ciclo de recompra, cross-sell), **Estatísticas** (resumo, ABC, última compra, fat mensal, 3 anos, YoY, classificação produtos, status clientes), **Curva ABC**, **Metas** (por indústria, positivação, ticket), **Equipe** (cockpit de vendedores, cobertura, visitas sem retorno, abandono de campo, heatmap), **Produtos** (ranking, grupos, top SKUs), **Sell In/Out** (KPIs, ranking, cruzamento). Transversais: faixa de **Alertas** (inativos/zeradas/queda), filtros multi-ano, métrica R$/Qtd/SKU, drill 5 níveis.

## 10. Central de Estatísticos (Topo → Central Estatísticos) — mapas
Mapa por Indústria · Mapa de Vendas · Sell-in por Período · Sell-out por Período · Mapa CLI/Indústria · Clientes Ano a Ano · Mapa Mensal de Itens · **Mapa Itens × Clientes** · Comparativo Clientes · Grupo de Lojas · Itens Nunca Comprados · Mapa 3 Anos · Últimas Compras · Clientes Inativos · Prod. Única Compra · Venda Mensal Indústria · Mapa de Pedidos · Client Insight · Curva ABC Produtos · Mapa de Oportunidades (só ro_consult) · Portfólio por Indústria · Vendas × Churn Trimestral · Gap de Catálogo (cross-sell) · Indústrias Adormecidas (com export). *Cada um cruza cliente/indústria/produto × período; toggle Valores/Quantidades; export Excel.*

## 11. Metas & Campanhas
- **Metas por Indústria** (Topo → Metas) — mapa mensal pivotado: ano anterior, meta, realizado, % atingido, % vs ano anterior; cards Atingida/Em Risco/Abaixo.
- **Campanhas** (Topo → Campanhas) — abas Configurar/Acompanhar/Auditar. 4 tipos de meta: Crescimento (R$), Mix (famílias), Positivação (meses com pedido), Volume (un). Nasce SIMULAÇÃO → ATIVA. **Mede sell-out, não sell-in.** Premiação, tracking manual, alerta de atraso.

## 12. Dashboards & Relatórios
- **Dashboard** — PortalHome (master/gerência: KPIs, receita por indústria, comparativos, top clientes, insights IRIS) ou RepHome (vendedor: saudação, clientes sem pedido, KPIs, carteira, aniversariantes, agenda, Central de Comando). HomeRouter decide por perfil.
- **Central de Relatórios** (Topo → Relatórios) — 4 categorias: **Cadastros** (Clientes simplificada/selecionável, Indústrias, Transportadoras, Tabelas de preço com desconto/completa/reduzida, Clientes por indústria, Promoção de produtos, Clientes por área), **Vendas Realizadas** (Cotações pendentes, Vendas no período/sintético, por cliente/indústria, por cidade/estado, Produtos vendidos, por grupo/clientes), **Faturamento** (Comissão vendedores, Faturamento no período, Pedidos faturados, Faturamento pendente, Produtos não faturados), **Financeiro** (Contas pagar/receber por vencimento — em construção).

## 13. Cadastros & Administração
- **Indústrias** — CRUD com consulta Receita; abas Principal, Complemento (logo, % comissão, link catálogo + toggle Portal, **pedido mínimo**, descontos D1–D10), Contatos (com aniversário), Clientes que já compraram (export), Política Comercial (menor preço), **Meta Anual** (2024–2028), **IA/WhatsApp** (alimenta o conhecimento da IRIS por marca).
- **Vendedores** — CRUD/Ficha: Dados (avatar, CPF, **vínculo a usuário** de login, "cumpre metas" S/N = promotor), Indústrias (% comissão por indústria), Regiões, Metas (mensais por indústria/ano).
- **Transportadoras** — CRUD (dados, endereço, observações).
- **Grupos de Produtos** — CRUD com **comissão própria por grupo** (`gru_usa_percomiss`). **Grupos de Desconto** — CRUD com até 9 descontos em cascata.

## 14. Usuários, Perfis & Permissões (Utilitários → Usuários — só Master grava)
- **Políticas de Grupo** — permissões por grupo × módulo, 4 toggles (Visível/Incluir/Modificar/Excluir). CRUD de grupos.
- **Base de Usuários** — CRUD (nome, login, WhatsApp, grupo, senha, status).
- **Níveis:** Representante **Master** (admin, acesso total incl. Usuários/Configurações/Financeiro estratégico/IRIS Dev) · **Gerência** (comercial/CRM/BI/relatórios/Financeiro + Parâmetros) · **Operador** (vendedor/digitador). Hierarquia em `roles.ts` (Operador=1, Gerência=2, Master=3, SoftHam=4).

## 15. Parâmetros & Configurações (Utilitários)
- **Parâmetros** (Gerência+; cada um lê os próprios) — Interface (ordem, velocidade de digitação, pesquisa de produto/cliente, tipo CRM), Regras (duplicados, decimais, promo, código original, validades, salvar auto, desconto por grupo), Processamento (inicia como pedido/cotação, frete padrão, ordem de impressão, separar por grupo, baixa XML fecha pedido, layout 1–19, mensagem padrão), **SMTP** (com Testar) e **Central IMAP** (IRIS lê e-mails; com Testar).
- **Configurações** (só Master) — Dados da Empresa (CNPJ com Receita, logo), **modo de atendimento por vendedor** (1x1 × 1xN), **visibilidade da carteira** (cada um a sua × todos atendem todos).

## 16. IRIS & IA
- **Pergunte à IRIS** (chat IRIS Dev, só Master c/ IA) — pergunta em linguagem natural → tools determinísticas → texto + tabelas + KPIs + gráficos + mapa. Varinha "melhorar prompt", exportar resposta em PDF, modal de exemplos.
- **IRIS Config / Carta Confidencial** (Master) — "carta" de instruções que molda a IRIS no atendimento WhatsApp; aprimorar com Claude; gerar template; vitrine de capacidades.
- **IRIS Voice (Nexus IA)** — briefing matinal por voz (TTS) ao tocar o orbe.
- **IRIS na Cotação** — cron 60s varre cotações pendentes, resolve preços/embalagens/qtd automaticamente.
- **Kill-switch** — telas IRIS redirecionam se a IA do tenant está desligada (`plano_ia_nivel`).

## 17. Fiscal, E-mails, Notícias & WhatsApp
- **NF-e (Baixa de Pedido)** — upload do XML, preview de alocação por pedido/item, aplica faturamento.
- **Envio de E-mails** — disparo em massa filtrado (destinatários, área, aniversariantes, indústria, prospecção) com anexos; envio de pedido por e-mail; testar SMTP.
- **Central de E-mails Inteligente** — caixa IMAP unificada; IA classifica em leads/cotações/pedidos/suporte/reclamação; gestão de estado; responder direto; inbox bruto; config por tenant.
- **Central de Notícias** — feed de novidades do sistema pros REPs (vive no master, compartilhado).
- **WhatsApp** — webhook Evolution; IA de atendimento; pedido por conversa; dashboard de conversas (assumir/devolver à IA/encerrar); vincular instância (QR).
- **Centro de Aprendizado** — podcasts/tutoriais capitulados. **Manual online** — leitor do manual oficial (busca o `.md` em runtime). **IRIS How-to** — assistente "como faço" alimentado pelo manual vivo.

## 18. App Mobile (REP em rua — PWA offline-first)
- **Login** (CNPJ+nome+senha, sessão única), **Home** (vendas/meta/ticket/pedidos/clientes ativos/churn, seletor mês), **Briefing** (resumo do dia pela IA), **Clientes** (carteira com filtros de risco, ligar/WhatsApp/Maps, offline), **Editar Cliente**, **Pedidos** (filtros, status, fila offline), **Pedido** (montar por indústria/tabela, busca, **Smart Order** = recompra por urgência, offline), **Tabela de Preços** (offline, cascata), **Sell-Out**, **Campanhas** (4 tipos), **Agenda** (tarefas + aniversariantes), **Rotas** + **Rota no Mapa** (Leaflet + Google Maps), **BI** (drill 5 níveis), **Aftermarket** (prospecção com GPS), **Despesas**. Promotor (`cumpremetas=N`) tem navegação reduzida (sem Pedidos/BI).

---

> **Como manter:** quando uma rotina nova for entregue (ou uma mudar de comportamento), atualizar a seção correspondente aqui. Este mapa é a fonte da IRIS pra "o que o sistema tem / onde está X".
