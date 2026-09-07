-- =============================================================================
-- AlDía — limpieza del modelo viejo
--
-- REQUISITO: haber corrido antes `seed-plan-mensual.sql`.
--
-- Borrón y cuenta nueva: se conservan los MOVIMIENTOS, y el resto del modelo
-- viejo se reemplaza por lo que sembramos.
--
-- ESTE SÍ BORRA. Es el único archivo del proyecto que borra datos:
--
--   1. Los 10 gastos fijos del modelo anterior, que quedaron duplicados al
--      lado de los sembrados (Aporte casa, Celular, Cooprudea, Corte de
--      cabello, Gasolina, HBO Max, iCloud, Mantenimiento Moto, SmartFit,
--      Spotify).
--
--   2. Las 9 deudas viejas Y SUS ABONOS, que se van por cascada. En su lugar
--      queda el libre inversión de Bancolombia, con el que se pagan todas.
--
--   3. Las metas de ahorro viejas y sus aportes: ese es el modelo que
--      reemplazaron los buckets.
--
-- LO QUE SE QUEDA, y por qué:
--
--   MOVIMIENTOS   son el registro de lo que de verdad pasó, y con eso se
--                 predice el comportamiento de los meses que vienen. Es lo
--                 único que no se puede volver a generar.
--
--   TARJETAS      no son del modelo viejo: el modelo nuevo las sigue usando
--                 (HBO y Spotify se pagan con crédito, y de la tarjeta salen
--                 las fechas de corte y de pago). Borrarlas dejaría los
--                 movimientos pasados diciendo "tarjeta eliminada" sin ganar
--                 nada. Si aun así las quieres fuera, dímelo.
--
--   CATEGORÍAS    las que creaste y los nombres que les cambiaste. Son
--                 presentación, y los movimientos que conservas las usan.
--
-- ANTES DE CORRERLO: exporta a Excel desde la app. Los abonos a esas 9 deudas
-- y los aportes a las metas viejas son historia que no está en ningún otro
-- lado y no se puede recuperar.
--
-- Los movimientos que apuntaban a un gasto fijo, una deuda o una meta que
-- desaparece se quedan donde están: el dinero salió de verdad. La app los
-- muestra como "eliminado" en vez de inventarse el dato.
-- =============================================================================

do $$
declare
  correo    text := 'camilo.zapatao2000@gmail.com';
  uid       uuid;
  n_fijos   int;
  n_deudas  int;
  n_abonos  int;
  n_metas   int;
  n_aportes int;
  n_movs    int;
  nombres   text;
begin

  select id into uid from auth.users where email = correo;
  if uid is null then
    raise exception 'No hay ninguna cuenta con el correo %.', correo;
  end if;
  perform set_config('aldia.uid', uid::text, false);

  -- ===========================================================================
  -- 1. Gastos fijos del modelo viejo
  --
  -- Los sembrados tienen id 'fix-...'. Los que creó la app tienen un id
  -- generado (timestamp en base 36 + azar), que nunca lleva guion. Por eso el
  -- corte es exacto y no hace falta borrar por nombre, que sí sería frágil.
  -- ===========================================================================
  select count(*), string_agg(name, ', ' order by name)
    into n_fijos, nombres
    from public.fixed_expenses
   where user_id = uid and id not like 'fix-%';

  if n_fijos > 0 then
    delete from public.fixed_expenses where user_id = uid and id not like 'fix-%';
    raise notice 'Gastos fijos del modelo viejo borrados (%): %', n_fijos, nombres;
  else
    raise notice 'No quedaban gastos fijos del modelo viejo.';
  end if;

  -- ===========================================================================
  -- 2. "Motilada" pasa a llamarse como la llamas tú
  --
  -- Es el mismo gasto y el mismo valor: solo cambia el nombre que ves.
  -- ===========================================================================
  update public.fixed_expenses
     set name = 'Corte de cabello'
   where user_id = uid and id = 'fix-motilada';

  -- ===========================================================================
  -- 3. Las deudas viejas
  --
  -- El libre inversión se pide para pagar todas las demás, así que dejan de
  -- existir como deuda: lo que se debe queda concentrado en una sola.
  --
  -- Sus abonos se van por cascada. Por eso el aviso de exportar a Excel.
  -- ===========================================================================
  select count(*) into n_deudas from public.debts where user_id = uid;
  select count(*) into n_abonos
    from public.debt_payments p
    join public.debts d on d.user_id = p.user_id and d.id = p.debt_id
   where p.user_id = uid;

  delete from public.debts where user_id = uid;
  raise notice 'Deudas borradas: %, con % abonos suyos.', n_deudas, n_abonos;

  -- ===========================================================================
  -- 4. Las metas de ahorro viejas
  --
  -- savings_goals es lo que los buckets reemplazaron. Un bucket sabe dos cosas
  -- que una meta no sabía: si es meta o colchón, y si puedes tocar la plata.
  --
  -- Sus aportes se van por cascada, igual que los abonos.
  -- ===========================================================================
  select count(*) into n_metas   from public.savings_goals      where user_id = uid;
  select count(*) into n_aportes from public.goal_contributions where user_id = uid;

  delete from public.savings_goals where user_id = uid;
  raise notice 'Metas viejas borradas: %, con % aportes suyos.', n_metas, n_aportes;

  -- ===========================================================================
  -- 5. El libre inversión de Bancolombia
  --
  --   saldo   14.000.000
  --   tasa    1,67% MENSUAL (así la reporta el banco)
  --   cuota   446.413, que no cambia al abonar de más
  --   modo    reducir-plazo: abonar de más acorta el crédito, no baja la cuota
  --
  -- start_date queda en el 1 de este mes porque no sé cuándo arrancó de verdad.
  -- No entra en ningún cálculo del plan; solo se ve en la pantalla de deudas.
  -- Para corregirla:
  --
  --   update public.debts set start_date = '2026-03-15'
  --    where id = 'debt-libre-inversion';
  -- ===========================================================================
  insert into public.debts (
    user_id, id, name, total_amount, interest_rate, monthly_payment,
    start_date, currency, fixed_payment, payoff_mode, current_balance
  ) values (
    uid, 'debt-libre-inversion', 'Libre inversión Bancolombia',
    14000000, 1.67, 446413,
    date_trunc('month', current_date)::date,
    'COP', 446413, 'reducir-plazo', 14000000
  )
  on conflict (user_id, id) do update
    set name            = excluded.name,
        interest_rate   = excluded.interest_rate,
        monthly_payment = excluded.monthly_payment,
        fixed_payment   = excluded.fixed_payment,
        payoff_mode     = excluded.payoff_mode,
        current_balance = excluded.current_balance;

  select count(*) into n_movs from public.transactions where user_id = uid;
  raise notice 'Limpieza lista. Se conservaron % movimientos.', n_movs;
end $$;


-- =============================================================================
-- Informe: cómo quedó el plan
--
-- La última fila es la que importa. Tiene que dar 737.587, el mismo número que
-- salía de tu hoja. Si da otra cosa, quedó algo sin limpiar.
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id),
plan as (
  select
    (select coalesce(sum(expected), 0) from public.income_sources
      where user_id = (select id from uid) and active)                        as ingresos,
    (select coalesce(sum(
              coalesce(f.total_amount, f.amount)
              - coalesce((select sum(s.amount) from public.fixed_expense_shares s
                           where s.user_id = f.user_id and s.fixed_expense_id = f.id), 0)
            ), 0)
       from public.fixed_expenses f where f.user_id = (select id from uid))   as fijos,
    (select coalesce(sum(fixed_payment), 0) from public.debts
      where user_id = (select id from uid))                                   as cuota_deuda,
    (select coalesce(sum(monthly_amount), 0) from public.buckets
      where user_id = (select id from uid) and kind = 'meta')                 as metas,
    (select coalesce(sum(monthly_amount), 0) from public.buckets
      where user_id = (select id from uid) and kind = 'colchon')              as colchones,
    (select coalesce(max(variable_estimate), 0) from public.monthly_plans
      where user_id = (select id from uid)
        and month = to_char(current_date, 'YYYY-MM'))                         as variable
)
select linea, valor from (
  select 1 as n, 'Ingresos'                     as linea, ingresos    as valor from plan
  union all select 2, 'Gastos fijos (tu parte)',      -fijos       from plan
  union all select 3, 'Cuota de la deuda',            -cuota_deuda from plan
  union all select 4, 'Metas de ahorro',              -metas       from plan
  union all select 5, 'Gasto variable estimado',      -variable    from plan
  union all select 6, 'Colchones',                    -colchones   from plan
  union all select 7, 'DISPONIBLE PARA ABONO EXTRA',
            ingresos - fijos - cuota_deuda - metas - variable - colchones from plan
) x order by n;
