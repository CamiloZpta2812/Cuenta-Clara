-- =============================================================================
-- AlDía v2 — plan mensual, gastos compartidos y deuda con amortización
--
-- Ejecuta esto en Supabase: Dashboard -> SQL Editor -> New query -> pega y Run.
-- Después corre `supabase/verify-rls.sql` y confirma que todo salga en OK.
--
-- REQUISITO: haber corrido antes `supabase/schema.sql`. Este archivo se apoya
-- en las tablas que aquel crea.
--
-- Es seguro correrlo varias veces.
--
-- NO BORRA NADA. Las tablas viejas `savings_goals` y `goal_contributions` se
-- quedan intactas como respaldo aunque la app deje de usarlas; lo mismo la
-- columna `month_start_day`, que ya no se lee. Cuando lleves un tiempo
-- tranquilo puedes limpiarlas a mano.
-- =============================================================================


-- =============================================================================
-- 1. Personas a las que les cobras
-- =============================================================================
create table if not exists public.people (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  name    text not null,
  -- Reservado para cuando dos usuarios de la app quieran vincular sus cuentas y
  -- que un cobro le aparezca al otro como algo que debe. Hoy siempre es null.
  -- A propósito SIN llave foránea a auth.users: sin uso real, una FK solo
  -- serviría para averiguar si un uuid existe o no.
  linked_user_id uuid,
  primary key (user_id, id)
);


-- =============================================================================
-- 2. Fuentes de ingreso
--
-- El monto esperado es el PLAN, no la verdad. Lo que de verdad entró son
-- movimientos de tipo ingreso; la app compara los dos y señala la diferencia.
-- =============================================================================
create table if not exists public.income_sources (
  user_id  uuid not null references auth.users(id) on delete cascade,
  id       text not null,
  name     text not null,
  expected numeric not null default 0,
  variable boolean not null default false,
  active   boolean not null default true,
  primary key (user_id, id)
);


-- =============================================================================
-- 3. Gastos fijos compartidos
--
-- Un gasto fijo tiene un valor total y un reparto entre personas. TU parte NO
-- se guarda: es el total menos lo repartido. Guardarla sería tener el mismo
-- dato dos veces y poder descuadrarlo.
-- =============================================================================
alter table public.fixed_expenses add column if not exists total_amount numeric;

-- Los gastos que ya existían no estaban compartidos: su total es lo que pagabas.
update public.fixed_expenses set total_amount = amount where total_amount is null;

create table if not exists public.fixed_expense_shares (
  user_id          uuid not null references auth.users(id) on delete cascade,
  id               text not null,
  fixed_expense_id text not null,
  person_id        text not null,
  amount           numeric not null,
  primary key (user_id, id),
  foreign key (user_id, fixed_expense_id)
    references public.fixed_expenses(user_id, id) on delete cascade,
  -- Si borras a una persona, su parte desaparece y tu parte del gasto sube
  -- sola. Es el comportamiento correcto: alguien dejó de aportar.
  foreign key (user_id, person_id)
    references public.people(user_id, id) on delete cascade
);

create index if not exists shares_expense_idx
  on public.fixed_expense_shares (user_id, fixed_expense_id);


-- =============================================================================
-- 4. Cobros
--
-- Solo se guarda lo YA COBRADO. Lo pendiente se deduce del reparto, así que no
-- hay que generar filas por adelantado cada mes ni limpiarlas si algo cambia.
-- =============================================================================
create table if not exists public.collections (
  user_id      uuid not null references auth.users(id) on delete cascade,
  id           text not null,
  month        text not null,          -- 'YYYY-MM', siempre mes calendario
  share_id     text not null,
  collected_at date,
  primary key (user_id, id),
  -- Un cobro por persona por mes: marcar dos veces no puede duplicar.
  unique (user_id, month, share_id),
  foreign key (user_id, share_id)
    references public.fixed_expense_shares(user_id, id) on delete cascade
);

create index if not exists collections_month_idx on public.collections (user_id, month);


-- =============================================================================
-- 5. Buckets: ahorro y colchones
--
-- Reemplaza a savings_goals. Dos ejes que antes no existían:
--
--   kind    'meta'    tiene un objetivo al que llegar
--           'colchon' margen sin objetivo, no es ahorro con destino
--   liquid  false     está ahí pero no lo puedes tocar (aporte a cooperativa)
--
-- Un aporte a una cooperativa es ahorro pero no es plata disponible, y un
-- colchón no debería mostrarse como si fuera camino a alguna meta.
-- =============================================================================
create table if not exists public.buckets (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  name           text not null,
  kind           text not null default 'meta' check (kind in ('meta', 'colchon')),
  liquid         boolean not null default true,
  monthly_amount numeric not null default 0,
  target_amount  numeric,
  target_date    date,
  primary key (user_id, id)
);

create table if not exists public.bucket_contributions (
  user_id   uuid not null references auth.users(id) on delete cascade,
  id        text not null,
  bucket_id text not null,
  amount    numeric not null,   -- negativo = retiro
  date      date not null,
  month     text not null,
  primary key (user_id, id),
  foreign key (user_id, bucket_id)
    references public.buckets(user_id, id) on delete cascade
);

create index if not exists bucket_contributions_idx
  on public.bucket_contributions (user_id, bucket_id);


-- =============================================================================
-- 6. Deuda con amortización
--
-- interest_rate ya existía y es el porcentaje MENSUAL (1.67 = 1,67%). Se
-- reutiliza en vez de agregar una columna con la misma cifra en decimal, que
-- solo serviría para que las dos se contradigan.
--
-- payoff_mode: qué hace el banco cuando abonas de más.
--   'reducir-plazo'  la cuota sigue igual y se acaban antes las cuotas
--   'reducir-cuota'  el plazo sigue igual y baja el valor de la cuota
-- =============================================================================
alter table public.debts add column if not exists fixed_payment numeric;
alter table public.debts add column if not exists payoff_mode text
  not null default 'reducir-plazo';
alter table public.debts add column if not exists current_balance numeric;

-- La cuota fija: si no estaba, se toma la que ya había como pago mensual.
update public.debts set fixed_payment = monthly_payment where fixed_payment is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'debts_payoff_mode_check') then
    alter table public.debts add constraint debts_payoff_mode_check
      check (payoff_mode in ('reducir-plazo', 'reducir-cuota'));
  end if;
end $$;

-- El saldo que reporta el banco, para poder cuadrar contra el modelo. Si queda
-- null, la app calcula el saldo desde los abonos registrados.
alter table public.debt_payments add column if not exists balance_after numeric;
alter table public.debt_payments add column if not exists month text;

update public.debt_payments set month = to_char(date, 'YYYY-MM') where month is null;


-- =============================================================================
-- 7. Movimientos: mes del plan y salida de caja
--
-- month         a qué mes cuenta el movimiento. Casi siempre el de su fecha,
--               pero si la quincena del 30 cae domingo y te pagan el 2, ese
--               ingreso sigue siendo del mes anterior.
-- cash_out_date cuándo sale la plata de verdad. Con efectivo o débito es el
--               mismo día; con tarjeta de crédito es cuando pagas la factura.
--
-- Un gasto con tarjeta del 20 de septiembre es GASTO de septiembre y SALIDA DE
-- CAJA de noviembre. Antes la app restaba del saldo el día de la compra y
-- además nunca modelaba el pago de la factura: estaba mal por los dos lados.
-- =============================================================================
alter table public.transactions add column if not exists month text;
alter table public.transactions add column if not exists cash_out_date date;
alter table public.transactions add column if not exists bucket_id text;
alter table public.transactions add column if not exists income_source_id text;

update public.transactions set month = to_char(date, 'YYYY-MM') where month is null;
update public.transactions set cash_out_date = date where cash_out_date is null;

create index if not exists transactions_month_idx on public.transactions (user_id, month);
create index if not exists transactions_cashout_idx
  on public.transactions (user_id, cash_out_date);


-- =============================================================================
-- 8. Plan mensual
--
-- Una foto por mes de los números con los que se juzga ese mes. Si en diciembre
-- te sube el arriendo, noviembre no debería reescribirse: se comparó contra el
-- plan que tenía entonces.
--
-- Los meses pasados quedan con locked = true y la app no los vuelve a tocar.
-- =============================================================================
create table if not exists public.monthly_plans (
  user_id           uuid not null references auth.users(id) on delete cascade,
  month             text not null,      -- 'YYYY-MM'
  expected_income   numeric not null default 0,
  fixed_expenses    numeric not null default 0,
  debt_payment      numeric not null default 0,
  savings           numeric not null default 0,
  variable_estimate numeric not null default 0,
  cushion           numeric not null default 0,
  locked            boolean not null default false,
  updated_at        timestamptz not null default now(),
  primary key (user_id, month)
);


-- =============================================================================
-- 9. Ajustes
-- =============================================================================
alter table public.user_settings add column if not exists setup_completed_at timestamptz;


-- =============================================================================
-- Row Level Security para las tablas nuevas
--
-- Tabla por tabla y sin bucles, para que el validador de Supabase pueda
-- verificarlo de forma estática. Es lo único que impide que la anon key —que
-- viaja en el código del navegador— lea las finanzas de cualquiera.
-- =============================================================================

alter table public.people enable row level security;
alter table public.income_sources enable row level security;
alter table public.fixed_expense_shares enable row level security;
alter table public.collections enable row level security;
alter table public.buckets enable row level security;
alter table public.bucket_contributions enable row level security;
alter table public.monthly_plans enable row level security;

drop policy if exists people_own on public.people;
create policy people_own on public.people
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists income_sources_own on public.income_sources;
create policy income_sources_own on public.income_sources
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists fixed_expense_shares_own on public.fixed_expense_shares;
create policy fixed_expense_shares_own on public.fixed_expense_shares
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists collections_own on public.collections;
create policy collections_own on public.collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists buckets_own on public.buckets;
create policy buckets_own on public.buckets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bucket_contributions_own on public.bucket_contributions;
create policy bucket_contributions_own on public.bucket_contributions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists monthly_plans_own on public.monthly_plans;
create policy monthly_plans_own on public.monthly_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
