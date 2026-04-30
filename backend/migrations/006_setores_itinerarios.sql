-- ── Setores / Bairros ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setores (
    set_codigo  SERIAL PRIMARY KEY,
    set_nome    VARCHAR(60) NOT NULL,
    set_obs     VARCHAR(200),
    set_regiao  INTEGER REFERENCES regioes(reg_codigo) ON DELETE SET NULL,
    gid         VARCHAR(38)
);

-- ── Itinerários de Visita ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS itinerarios (
    iti_codigo  SERIAL PRIMARY KEY,
    iti_nome    VARCHAR(60) NOT NULL,
    iti_dia     VARCHAR(20),
    iti_obs     VARCHAR(200),
    gid         VARCHAR(38)
);
