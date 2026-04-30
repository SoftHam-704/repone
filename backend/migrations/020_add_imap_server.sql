-- ─── 020_add_imap_server.sql ───────────────────────────────────────────────────
-- Adiciona campo para servidor IMAP separado do SMTP

ALTER TABLE parametros
  ADD COLUMN IF NOT EXISTS par_imap_server VARCHAR(255);

-- Opcional: Popular com o valor do SMTP se estiver nulo para não quebrar setups existentes
UPDATE parametros SET par_imap_server = par_emailserver WHERE par_imap_server IS NULL AND par_emailserver IS NOT NULL;
