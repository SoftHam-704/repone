-- ── Vendedor vinculado ao itinerário ─────────────────────────
ALTER TABLE itinerarios ADD COLUMN IF NOT EXISTS iti_vendedor INTEGER REFERENCES vendedores(ven_codigo) ON DELETE SET NULL;

-- ── Paradas do Itinerário ─────────────────────────────────────
-- Vincula clientes a um itinerário com ordem de visita
CREATE TABLE IF NOT EXISTS itinerario_paradas (
    itp_codigo     SERIAL PRIMARY KEY,
    itp_itinerario INTEGER NOT NULL REFERENCES itinerarios(iti_codigo) ON DELETE CASCADE,
    itp_cliente    INTEGER NOT NULL REFERENCES clientes(cli_codigo) ON DELETE CASCADE,
    itp_ordem      INTEGER NOT NULL DEFAULT 0,
    itp_obs        VARCHAR(200),
    UNIQUE(itp_itinerario, itp_cliente)
);

CREATE INDEX IF NOT EXISTS idx_itp_itinerario ON itinerario_paradas(itp_itinerario);
