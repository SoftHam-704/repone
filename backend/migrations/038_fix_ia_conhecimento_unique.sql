-- Migration 038: garante UNIQUE constraint em ia_conhecimento.for_codigo
-- Necessário para o ON CONFLICT funcionar em schemas migrados do V1
CREATE UNIQUE INDEX IF NOT EXISTS uq_ia_conhecimento_for_codigo
  ON ia_conhecimento(for_codigo);
