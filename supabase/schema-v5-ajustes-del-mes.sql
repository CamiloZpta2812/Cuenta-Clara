-- =============================================================================
-- AlDía — ajustes de un solo mes
--
-- NO BORRA NADA. Agrega una tabla.
--
-- El problema: un colchón tiene un monto mensual y ese monto es para siempre.
-- Cuando Camilo decide "este mes le meto 150.000 al colchón de seguridad en
-- vez de 300.000", la única forma de decírselo a la app era cambiar el monto
-- del colchón — y entonces octubre, y noviembre, y todos los que siguen,
-- ahorran la mitad sin que nadie se dé cuenta. Un mes flojo se volvía un
-- recorte permanente por olvido.
--
-- La alternativa era no decírselo y aportar de menos, pero eso deja el plan
-- diciendo que faltan 150.000 y la pantalla marcando un desvío en rojo sobre
-- una decisión tomada a propósito. Una app que regaña por lo que uno decidió
-- es una app que uno deja de abrir.
--
-- Un ajuste es entonces una frase con fecha de vencimiento: "en 2026-09, este
-- bucket va por 150.000". El mes siguiente vuelve solo a su monto normal,
-- porque el ajuste no lo tocó nunca.
--
-- Lleva `id` propio en vez de una llave compuesta (mes + bucket) para que la
-- capa de sincronización lo trate como a cualquier otra tabla: todas se
-- identifican por `id` salvo monthly_plans. El único por mes y por bucket lo
-- garantiza el unique de abajo, no la llave primaria.
-- =============================================================================

create table if not exists public.bucket_adjustments (
  user_id   uuid not null references auth.users(id) on delete cascade,
  id        text not null,
  month     text not null,            -- 'YYYY-MM', siempre mes calendario
  bucket_id text not null,
  amount    numeric not null,         -- TU parte para ese mes, no la del pote
  primary key (user_id, id),
  -- Un ajuste por bucket por mes: ajustar dos veces corrige, no acumula.
  unique (user_id, month, bucket_id),
  foreign key (user_id, bucket_id)
    references public.buckets(user_id, id) on delete cascade
);

create index if not exists bucket_adjustments_month_idx
  on public.bucket_adjustments (user_id, month);

alter table public.bucket_adjustments enable row level security;

drop policy if exists bucket_adjustments_own on public.bucket_adjustments;
create policy bucket_adjustments_own on public.bucket_adjustments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
