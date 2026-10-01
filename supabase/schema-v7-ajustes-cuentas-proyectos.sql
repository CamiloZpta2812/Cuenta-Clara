-- =============================================================================
-- AlDía — historial de ajustes, cuentas divididas y pagos de proyecto
--
-- NO BORRA NADA. Tres tablas nuevas y un traspaso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Historial de ajustes del saldo
--
-- Antes había un ancla sola: cada vez que cuadrabas con el banco, la anterior
-- se perdía y la gráfica del pulso arrancaba de nuevo desde ese día. Se perdía
-- la historia justo cuando más sentido tenía mirarla.
--
-- Con el historial, la curva se dibuja por tramos: cada ajuste vale desde su
-- día hasta el siguiente, y en el día del ajuste la línea pega el brinco —que
-- es exactamente lo que no habías registrado—. Lo de antes del primer ajuste
-- se reconstruye hacia atrás desde él.
-- -----------------------------------------------------------------------------
create table if not exists public.balance_anchors (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  date    date not null,
  amount  numeric not null,
  primary key (user_id, id),
  -- Un ajuste por día: cuadrar dos veces el mismo día corrige, no acumula.
  unique (user_id, date)
);

alter table public.balance_anchors enable row level security;
drop policy if exists balance_anchors_own on public.balance_anchors;
create policy balance_anchors_own on public.balance_anchors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/*
 * El ancla que ya existía pasa a ser el primer ajuste del historial. Las
 * columnas viejas de user_settings no se borran: quedan como respaldo, y la
 * app sigue escribiéndoles el último ajuste.
 */
insert into public.balance_anchors (user_id, id, date, amount)
select user_id, 'ancla-' || to_char(balance_anchor_date, 'YYYY-MM-DD'),
       balance_anchor_date, balance_anchor_amount
  from public.user_settings
 where balance_anchor_date is not null
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Cuentas divididas
--
-- Pagas la cuenta completa del restaurante y los demás te transfieren su
-- parte. El movimiento guarda el total —es lo que salió de tu cuenta— y aquí
-- va quién te debe cuánto. collected_at es el día en que te pagó: mientras
-- esté vacío, es plata tuya en la calle.
-- -----------------------------------------------------------------------------
create table if not exists public.transaction_shares (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  transaction_id text not null,
  person_id      text not null,
  amount         numeric not null check (amount >= 0),
  collected_at   date,
  primary key (user_id, id),
  foreign key (user_id, transaction_id)
    references public.transactions(user_id, id) on delete cascade,
  foreign key (user_id, person_id)
    references public.people(user_id, id) on delete cascade
);

create index if not exists transaction_shares_tx_idx
  on public.transaction_shares (user_id, transaction_id);

alter table public.transaction_shares enable row level security;
drop policy if exists transaction_shares_own on public.transaction_shares;
create policy transaction_shares_own on public.transaction_shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Pagos de proyecto
--
-- Un contrato no es un sueldo: paga lo que paga, cuando toca, y no se repite
-- cada mes. Por eso no cabe en income_sources, que es mensual. Cada pago es su
-- propia fila con su fecha, y cuenta en el plan del mes en que lo esperas.
--
-- Cuando te pagan, la app crea el ingreso de verdad y lo enlaza aquí con
-- transaction_id: así el plan sabe que ya llegó, y no queda contado dos veces.
-- -----------------------------------------------------------------------------
create table if not exists public.expected_incomes (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  project        text not null,
  name           text not null,
  amount         numeric not null check (amount >= 0),
  expected_date  date not null,
  transaction_id text,
  primary key (user_id, id)
);

create index if not exists expected_incomes_date_idx
  on public.expected_incomes (user_id, expected_date);

alter table public.expected_incomes enable row level security;
drop policy if exists expected_incomes_own on public.expected_incomes;
create policy expected_incomes_own on public.expected_incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
