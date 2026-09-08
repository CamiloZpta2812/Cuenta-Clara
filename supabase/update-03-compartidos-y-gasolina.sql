-- =============================================================================
-- AlDía — colchones compartidos con Sofi, y la gasolina como reserva
--
-- REQUISITO: haber corrido antes `schema-v3-buckets-compartidos.sql`.
--
-- Borra UNA fila: el gasto fijo "Gasolina", que pasa a ser un colchón. Nada
-- más. Tus movimientos no se tocan.
--
-- Tres cambios:
--
--   1. Sofi entra como persona, y los dos fondos que comparten con ella pasan
--      a guardar el TOTAL del pote, con su parte aparte.
--
--   2. La gasolina deja de ser un gasto fijo y pasa a ser una reserva: guardas
--      160.000 pero no los mueves a ningún lado, van saliendo cuando tanqueas.
--
--   3. El plan del mes se actualiza. El disponible NO cambia —sigue en
--      686.587—: la plata sale igual, solo queda en la casilla correcta.
-- =============================================================================

do $$
declare
  correo text := 'camilo.zapatao2000@gmail.com';
  uid    uuid;
begin

  select id into uid from auth.users where email = correo;
  if uid is null then
    raise exception 'No hay ninguna cuenta con el correo %.', correo;
  end if;
  perform set_config('aldia.uid', uid::text, false);

  -- ===========================================================================
  -- 1. Sofi
  --
  -- Va en `people` igual que Juanjo o Yeison, pero no va a aparecer en Cobros:
  -- un cobro nace del reparto de un GASTO FIJO, donde pagas tú y te devuelven.
  -- Acá cada uno mete lo suyo, así que no hay nada que cobrar.
  -- ===========================================================================
  insert into public.people (user_id, id, name) values (uid, 'p-sofi', 'Sofi')
  on conflict (user_id, id) do update set name = excluded.name;

  -- ===========================================================================
  -- 2. Los dos fondos comunes
  --
  -- El monto pasa a ser el del POTE. Tu parte se deduce restando lo de Sofi,
  -- así que las dos cifras no pueden descuadrar entre sí.
  -- ===========================================================================
  update public.buckets
     set monthly_amount = 130000, moves_cash = true
   where user_id = uid and id = 'bkt-gatos';

  update public.buckets
     set name = 'Fondo Sofi', monthly_amount = 600000, moves_cash = true
   where user_id = uid and id = 'bkt-ahorro-2';

  insert into public.bucket_shares (user_id, id, bucket_id, person_id, amount) values
    (uid, 'shr-gatos-sofi', 'bkt-gatos',    'p-sofi',  65000),
    (uid, 'shr-fondo-sofi', 'bkt-ahorro-2', 'p-sofi', 300000)
  on conflict (user_id, id) do update
    set bucket_id = excluded.bucket_id, person_id = excluded.person_id,
        amount = excluded.amount;

  -- ===========================================================================
  -- 3. La gasolina
  --
  -- Como gasto fijo había que fingir que se iba de un solo golpe; como gasto
  -- variable contaminaba la única línea que de verdad puedes mover. Es una
  -- reserva: moves_cash = false, y se llena con cada tanqueada.
  -- ===========================================================================
  insert into public.buckets
    (user_id, id, name, kind, liquid, monthly_amount, moves_cash)
  values
    (uid, 'bkt-gasolina', 'Gasolina', 'colchon', true, 160000, false)
  on conflict (user_id, id) do update
    set name = excluded.name, kind = excluded.kind,
        monthly_amount = excluded.monthly_amount, moves_cash = excluded.moves_cash;

  /*
   * Los movimientos que apuntaban al gasto fijo se reapuntan a la reserva
   * ANTES de borrarlo: si no, quedarían señalando algo que ya no existe y
   * pasarían a contar como gasto variable.
   */
  update public.transactions
     set fixed_expense_id = null, bucket_id = 'bkt-gasolina'
   where user_id = uid and fixed_expense_id = 'fix-gasolina';

  delete from public.fixed_expenses where user_id = uid and id = 'fix-gasolina';

  -- ===========================================================================
  -- 4. El plan del mes
  --
  --   fijos      746.000 − 160.000 de gasolina = 586.000
  --   colchones  465.000 + 160.000 de gasolina = 625.000
  --
  -- El disponible no se mueve: 3.600.000 − 586.000 − 446.413 − 426.000
  -- − 830.000 − 625.000 = 686.587. Igual que antes.
  -- ===========================================================================
  update public.monthly_plans
     set fixed_expenses = 586000, cushion = 625000, updated_at = now()
   where user_id = uid and month = to_char(current_date, 'YYYY-MM');

  raise notice 'Listo. Sofi agregada, dos fondos compartidos, gasolina como reserva.';
end $$;


-- =============================================================================
-- Informe: cómo quedan los buckets
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id)
select
  b.name                                                        as bucket,
  case when b.kind = 'colchon' then 'colchón' else 'meta' end   as tipo,
  case when b.moves_cash then 'mueve la plata' else 'reserva' end as modo,
  b.monthly_amount                                              as total_mes,
  b.monthly_amount - coalesce((
    select sum(s.amount) from public.bucket_shares s
     where s.user_id = b.user_id and s.bucket_id = b.id
  ), 0)                                                         as tu_parte,
  coalesce((
    select string_agg(p.name || ' (' || s.amount::text || ')', ', ')
      from public.bucket_shares s
      join public.people p on p.user_id = s.user_id and p.id = s.person_id
     where s.user_id = b.user_id and s.bucket_id = b.id
  ), '—')                                                       as comparten
from public.buckets b
where b.user_id = (select id from uid)
order by b.kind desc, b.name;
