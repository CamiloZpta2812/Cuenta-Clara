-- =============================================================================
-- AlDía v3 — colchones compartidos y reservas
--
-- REQUISITO: haber corrido `schema.sql` y `schema-v2-plan-mensual.sql`.
--
-- NO BORRA NADA. Una tabla nueva y una columna. Es seguro correrlo varias veces.
--
-- Dos cosas que el modelo v2 daba por sentadas y que no siempre son ciertas:
--
--   1. Que la plata del colchón es toda tuya. El colchón de los gatos son
--      $130.000 al mes entre dos: pones la mitad, pero cuando el veterinario
--      cobra, cobra del total. Ver solo tu parte te haría creer que tienes la
--      mitad de lo que hay.
--
--   2. Que apartar plata es moverla. Para los gatos sí: va a otra cuenta. Para
--      la gasolina no: los $160.000 se quedan donde están y van saliendo cuando
--      tanqueas. Tratarlos igual contaría la gasolina dos veces — el aporte y
--      cada tanqueada.
-- =============================================================================


-- =============================================================================
-- 1. Quién más pone en un bucket
--
-- Misma forma que fixed_expense_shares, y por la misma razón: TU parte no se
-- guarda. Es el total menos lo que ponen los demás, así que nunca pueden
-- descuadrar entre sí.
--
-- La diferencia con un gasto fijo compartido es de dónde sale la plata. En el
-- Spotify pagas tú y te devuelven, así que hay un cobro. Acá cada uno mete lo
-- suyo a un fondo común: nadie le debe nada a nadie, el pote simplemente es
-- más grande que tu aporte. Por eso esto NO genera cobros.
-- =============================================================================
create table if not exists public.bucket_shares (
  user_id   uuid not null references auth.users(id) on delete cascade,
  id        text not null,
  bucket_id text not null,
  person_id text not null,
  amount    numeric not null,
  primary key (user_id, id),
  foreign key (user_id, bucket_id)
    references public.buckets(user_id, id) on delete cascade,
  -- Si borras a la persona, su parte desaparece y la tuya sube sola: es el
  -- comportamiento correcto, alguien dejó de aportar.
  foreign key (user_id, person_id)
    references public.people(user_id, id) on delete cascade
);

create index if not exists bucket_shares_bucket_idx
  on public.bucket_shares (user_id, bucket_id);


-- =============================================================================
-- 2. ¿Apartar mueve la plata?
--
--   true   colchón de verdad: el aporte sale de tu cuenta hacia otra, y lo que
--          gastes después sale de ahí. Los gatos, la moto, los ahorros.
--
--   false  reserva: no mueves nada, solo apartas el cupo. La plata sigue en tu
--          cuenta y va saliendo con cada gasto. La gasolina.
--
-- En el plan las dos restan igual —es plata que no está disponible—, pero en lo
-- REAL se miden distinto: el colchón por lo que aportaste, la reserva por lo
-- que llevas gastado de ella.
-- =============================================================================
alter table public.buckets add column if not exists moves_cash boolean not null default true;


-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.bucket_shares enable row level security;

drop policy if exists bucket_shares_own on public.bucket_shares;
create policy bucket_shares_own on public.bucket_shares
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================================
-- Comprobación. Debe devolver una fila, en OK.
-- =============================================================================
select
  c.relname                as tabla,
  c.relrowsecurity         as rls_activo,
  count(p.polname)         as politicas,
  case
    when not c.relrowsecurity then 'SIN RLS  <-- REVISAR'
    when count(p.polname) = 0 then 'SIN POLITICA  <-- REVISAR'
    else 'OK'
  end                      as estado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relname = 'bucket_shares'
group by c.relname, c.relrowsecurity;
