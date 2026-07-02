-- ============================================================================
--  MIGRACIÓN: Color de las piezas
--  Para bases YA CREADAS. Pegar en: Supabase -> SQL Editor -> Run.
-- ============================================================================

alter table public.parts add column if not exists color text;
