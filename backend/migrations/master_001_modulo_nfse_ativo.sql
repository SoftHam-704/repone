-- MASTER DB (public.empresas) — NÃO é por-tenant. Roda UMA vez no banco master.
-- Flag de produto: libera/bloqueia a emissão de NFS-e por empresa (queima crédito ACBr pago).
-- Default false = BLOQUEADO (opt-in). Habilitar quem paga:
--   UPDATE public.empresas SET modulo_nfse_ativo = true WHERE cnpj = '...';
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS modulo_nfse_ativo BOOLEAN NOT NULL DEFAULT false;
