# Perfil Promotor no Mobile — Design

**Data:** 2026-06-03
**Status:** Aguardando revisão
**Origem:** Pedido do REP (Dama) — promotores de vendas só fazem visitas, não vendem.

## Problema

Existem **promotores de vendas**: responsáveis apenas por visitas, **não vendem nada**.
Para esse perfil, as opções de venda no home do app mobile (Pedidos, Catálogo, BI, Smart Mix)
são ruído. O REP pediu para ocultá-las **apenas para esse perfil**.

**Princípio (Hamilton):** a vontade de 1 REP não atropela os 30. A mudança **não pode impactar
nenhum dos reps vendedores** — só o promotor vê o home enxuto.

## Decisão de identificação do promotor

Reusar o campo **`vendedores.ven_cumpremetas`** (já existente). Quando `'N'`, o vendedor já é
**excluído de todas as métricas de venda do BI** (regra de 2026-05-23) — ou seja, já carrega a
semântica "não vende / fora das metas". Evita criar um segundo flag a manter em sincronia.

Define-se **promotor** como: `ven_cumpremetas = 'N'` **E** `role = 'user'`.
O `role='user'` garante que **gerentes/admins nunca são afetados** mesmo que tenham `cumpremetas='N'`
(eles têm role `manager`/`admin`). Reps vendedores têm `cumpremetas` `'S'`/null → nunca promotores.

## Arquitetura

### Backend — `backend/src/modules/auth/auth.controller.ts`

O usuário é carregado de `user_nomes` (linha ~126). A `role` é determinada (~224).
Após determinar a role e **antes de gerar o JWT** (~226), buscar o flag do vendedor ligado:

```ts
// Promotor: vendedor ligado com ven_cumpremetas='N' e role 'user' (não-gestor).
let isPromotor = false;
if (role === 'user') {
  try {
    const vr = await client.query(
      `SELECT ven_cumpremetas FROM vendedores WHERE ven_codusu = $1 LIMIT 1`,
      [user.id]
    );
    isPromotor = String(vr.rows[0]?.ven_cumpremetas || 'S').toUpperCase() === 'N';
  } catch { isPromotor = false; }
}
```

> `client` = a conexão do tenant usada nas demais queries do login (mesma de `userResult`).
> Confirmar o nome exato da variável de conexão na implementação.

Adicionar `isPromotor` em **dois lugares**:
1. No payload do JWT (`jwt.sign({ ... , isPromotor })`).
2. No objeto `user` da resposta (`res.json({ user: { ... , isPromotor } })`).

### Frontend — tipo do usuário

`src/shared/stores/useAuthStore.ts` — adicionar `isPromotor?: boolean` à interface `User`.

### Mobile — esconder opções quando promotor

Ler `const isPromotor = useAuthStore(s => s.user?.isPromotor);`

- **`src/mobile/pages/HomePage.tsx`** — no `ACTIONS` (ou no `.map`), filtrar quando `isPromotor`:
  esconder os cards **Novo Pedido** (`/mobile/pedido`), **Catálogo** (`/mobile/precos`),
  **Smart Mix** (`#`) e **BI** (`/mobile/bi`). Manter: Agenda, Clientes, Sell-Out, Campanhas,
  Rotas, Aftermarket (e Despesas, da Entrega 2).
- **`src/mobile/components/BottomNav.tsx`** — filtrar do `TABS` quando `isPromotor`: esconder
  **Pedidos** (`/mobile/pedidos`) e **BI** (`/mobile/bi`). Navbar do promotor:
  Home · Clientes · Rotas · Sell-Out (4 abas).
- As seções de Metas/Performance do home já são escondidas para `role='user'` (gating existente),
  então o promotor já não as vê — nada a fazer ali.

### Sem guarda de rota (YAGNI V1)

Esconder as entradas basta para V1. Deep-links diretos (`/mobile/pedido`) continuam acessíveis,
mas o promotor não tem como chegar lá pela UI. Guarda de rota fica para depois se necessário.

## Impacto / Risco

- **Reps vendedores (os 30): zero mudança.** Só `isPromotor` muda o render, e ele exige
  `cumpremetas='N'` + `role='user'`.
- Login faz **1 query extra** leve (indexável por `ven_codusu`) só para `role='user'`. Desprezível.
- Se o vendedor não estiver ligado ao usuário (`ven_codusu` nulo), `isPromotor=false` (mostra tudo) —
  fallback seguro.

## Testes (piloto manual)

- Usuário promotor (`cumpremetas='N'`, role user) → home sem Novo Pedido/Catálogo/Smart Mix/BI;
  navbar sem Pedidos/BI.
- Rep vendedor normal (`cumpremetas='S'`/null) → home e navbar **idênticos a hoje**.
- Gerente (`role='manager'`, mesmo com `cumpremetas='N'`) → vê tudo.

## Fora de escopo

- Esconder no app web (pedido é do mobile).
- Guarda de rota / bloqueio de deep-link.
- Qualquer mudança para os reps vendedores.
