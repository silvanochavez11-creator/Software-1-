-- ============================================================================
--  MIGRACIÓN: Precio de mayoreo por pieza
--  Para bases YA CREADAS. Pegar en: Supabase -> SQL Editor -> Run.
-- ============================================================================

alter table public.parts add column if not exists price_wholesale numeric default 0;
