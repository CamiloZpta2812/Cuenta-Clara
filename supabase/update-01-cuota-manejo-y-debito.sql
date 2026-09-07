-- =============================================================================
-- AlDía — cuota de manejo y método de pago
--
-- REQUISITO: haber corrido antes `seed-plan-mensual.sql` y
-- `cleanup-modelo-viejo.sql`.
--
-- NO BORRA NADA. Dos cambios:
--
--   1. Entra la cuota de manejo de la tarjeta ($51.000). Sale todos los meses
--      aunque no uses la tarjeta, así que es un gasto fijo — y hasta ahora no
--      estaba en ninguna parte del plan.
--
--   2. Todos los gastos fijos quedan en débito. Estaban con el método vacío, y
--      la pantalla, al no encontrar ninguno, mostraba el primero de la lista:
--      te decía "Efectivo" sobre un dato que en realidad no existía.
-- =============================================================================

do $$
declare
  correo text := 'camilo.zapatao2000@gmail.com';
  uid    uuid;
  n      int;
begin

  select id into uid from auth.users where email = correo;
  if uid is null then
    raise exception 'No hay ninguna cuenta con el correo %.', correo;
  end if;
  perform set_config('aldia.uid', uid::text, false);

  -- ===========================================================================
  -- 1. Cuota de manejo
  --
  -- Va como débito igual que los demás porque así sale de tu cuenta. Si el
  -- banco te la cobra dentro de la factura de la tarjeta, avísame: cambia
  -- cuándo sale la plata, no cuánto.
  -- ===========================================================================
  insert into public.fixed_expenses
    (user_id, id, name, category, amount, total_amount, payment_method)
  values
    (uid, 'fix-cuota-manejo', 'Cuota de manejo tarjeta', 'servicios', 51000, 51000, 'debito')
  on conflict (user_id, id) do update
    set name = excluded.name, category = excluded.category,
        amount = excluded.amount, total_amount = excluded.total_amount,
        payment_method = excluded.payment_method;

  -- ===========================================================================
  -- 2. Todo lo fijo sale de la cuenta de ahorros
  -- ===========================================================================
  update public.fixed_expenses
     set payment_method = 'debito'
   where user_id = uid and payment_method is distinct from 'debito';

  get diagnostics n = row_count;
  raise notice 'Gastos fijos pasados a débito: %.', n;

end $$;


-- =============================================================================
-- Informe: el plan con la cuota de manejo adentro
--
-- El disponible baja de 737.587 a 686.587: son los mismos 51.000 que ya te
-- estaban saliendo del bolsillo sin aparecer en ninguna cuenta.
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id),
plan as (
  select
    (select coalesce(sum(expected), 0) from public.income_sources
      where user_id = (select id from uid) and active)                         as ingresos,
    (select coalesce(sum(
              coalesce(f.total_amount, f.amount)
              - coalesce((select sum(s.amount) from public.fixed_expense_shares s
                           where s.user_id = f.user_id and s.fixed_expense_id = f.id), 0)
            ), 0)
       from public.fixed_expenses f where f.user_id = (select id from uid))    as fijos,
    (select coalesce(sum(fixed_payment), 0) from public.debts
      where user_id = (select id from uid))                                    as cuota_deuda,
    (select coalesce(sum(monthly_amount), 0) from public.buckets
      where user_id = (select id from uid) and kind = 'meta')                  as metas,
    (select coalesce(sum(monthly_amount), 0) from public.buckets
      where user_id = (select id from uid) and kind = 'colchon')               as colchones,
    (select coalesce(max(variable_estimate), 0) from public.monthly_plans
      where user_id = (select id from uid)
        and month = to_char(current_date, 'YYYY-MM'))                          as variable
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
