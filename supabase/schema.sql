-- =============================================================================
-- AlDía — esquema de tablas reales
--
-- Ejecuta esto en Supabase: Dashboard -> SQL Editor -> New query -> pega y Run.
--
-- Es seguro correrlo varias veces: todo está escrito para ser idempotente.
-- NO borra la tabla `kv_store` donde vivían tus datos antes; la app migra sola
-- ese JSON a estas tablas la primera vez que entras, y kv_store se queda ahí
-- como respaldo. Cuando lleves un tiempo y estés tranquilo, puedes borrarla con:
--     drop table public.kv_store;
--
-- Sobre los ids: son texto, no uuid, porque los genera la app en el navegador y
-- las referencias entre registros (cuotas, tarjetas, abonos) ya existen en tus
-- datos actuales. Mantenerlos evita tener que reescribirlas al migrar.
-- =============================================================================

-- ---------------------------------------------------------------- ajustes
create table if not exists public.user_settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  month_start_day int not null default 1 check (month_start_day between 1 and 28),
  category_labels jsonb not null default '{}'::jsonb,
  migrated_at     timestamptz,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- categorías propias
create table if not exists public.custom_categories (
  user_id  uuid not null references auth.users(id) on delete cascade,
  id       text not null,
  type     text not null check (type in ('gasto', 'ingreso')),
  label    text not null,
  icon_key text,
  color    text,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- tarjetas
create table if not exists public.credit_cards (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  name        text not null,
  last_four   text,
  currency    text not null default 'COP' check (currency in ('COP', 'USD')),
  cut_day     int check (cut_day between 1 and 31),
  payment_day int check (payment_day between 1 and 31),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- gastos fijos
create table if not exists public.fixed_expenses (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  name           text not null,
  category       text not null,
  amount         numeric not null,
  due_day        int check (due_day between 1 and 31),
  payment_method text,
  card_id        text,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- deudas
create table if not exists public.debts (
  user_id         uuid not null references auth.users(id) on delete cascade,
  id              text not null,
  name            text not null,
  total_amount    numeric not null,
  interest_rate   numeric not null default 0,
  monthly_payment numeric not null default 0,
  due_day         int check (due_day between 1 and 31),
  start_date      date not null,
  currency        text not null default 'COP' check (currency in ('COP', 'USD')),
  exchange_rate   numeric,
  primary key (user_id, id)
);

create table if not exists public.debt_payments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  debt_id text not null,
  amount  numeric not null,
  date    date not null,
  primary key (user_id, id),
  foreign key (user_id, debt_id) references public.debts(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- metas de ahorro
create table if not exists public.savings_goals (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null,
  name          text not null,
  target_amount numeric,
  target_date   date,
  primary key (user_id, id)
);

create table if not exists public.goal_contributions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null,
  goal_id text not null,
  amount  numeric not null,   -- puede ser negativo: un retiro de la meta
  date    date not null,
  primary key (user_id, id),
  foreign key (user_id, goal_id) references public.savings_goals(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- movimientos
create table if not exists public.transactions (
  user_id             uuid not null references auth.users(id) on delete cascade,
  id                  text not null,
  type                text not null check (type in ('gasto', 'ingreso')),
  amount              numeric not null,
  category            text not null,
  date                date not null,
  note                text not null default '',
  payment_method      text,
  card_id             text,
  is_fixed            boolean not null default false,
  is_installment      boolean not null default false,
  total_installments  int,
  current_installment int,
  interest_rate       numeric,
  total_amount        numeric,
  installment_group_id text,
  currency            text not null default 'COP' check (currency in ('COP', 'USD')),
  original_amount     numeric,
  exchange_rate_used  numeric,
  fixed_expense_id    text,
  debt_id             text,
  debt_payment_id     text,
  created_at          timestamptz not null default now(),
  primary key (user_id, id)
);

/*
 * card_id, fixed_expense_id, debt_id y debt_payment_id se dejan a propósito SIN
 * llave foránea. La app conserva el movimiento cuando borras la tarjeta, el
 * gasto fijo o la deuda que lo originó (el dinero salió de verdad, y la lista
 * muestra "tarjeta eliminada"). Un ON DELETE SET NULL borraría esa referencia
 * en la base y dejaría la app y Postgres contando cosas distintas.
 *
 * Donde sí hay cascada es en debt_payments y goal_contributions, porque ahí la
 * app sí borra los hijos junto con el padre.
 */

-- created_at desempata los movimientos del mismo día, que antes quedaban en
-- orden arbitrario porque solo se ordenaba por fecha.
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);
create index if not exists transactions_user_group_idx
  on public.transactions (user_id, installment_group_id)
  where installment_group_id is not null;
create index if not exists debt_payments_debt_idx on public.debt_payments (user_id, debt_id);
create index if not exists goal_contributions_goal_idx on public.goal_contributions (user_id, goal_id);

-- =============================================================================
-- Row Level Security: cada usuario solo ve y toca lo suyo.
-- =============================================================================
do $$
declare
  t text;
  tables text[] := array['user_settings', 'custom_categories', 'credit_cards', 'fixed_expenses',
                         'debts', 'debt_payments', 'savings_goals', 'goal_contributions',
                         'transactions'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    -- se recrean para que correr el script de nuevo no falle ni deje políticas viejas
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_own', t);
  end loop;
end $$;
