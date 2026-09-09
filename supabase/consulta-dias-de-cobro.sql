-- =============================================================================
-- AlDía — ¿qué día te cobran cada gasto fijo?
--
-- SOLO LEE. No escribe nada, se puede correr las veces que sea.
--
-- El día de cobro es el único dato que le falta a "Esta semana te cobran", y
-- no se puede adivinar: una alerta con la fecha equivocada es peor que no
-- tener alerta. Pero tampoco hace falta escribirlos todos a mano — el día en
-- que has pagado cada cosa ya está en tus movimientos.
--
-- Esta consulta saca ese día de tu historial y marca de dónde salió:
--
--   historial     lo pagaste ese día, es un dato tuyo
--   aproximado    lo puse yo al sembrar (update-04) con fecha del 8, así que
--                 no significa nada: ese día me lo inventé
--   sin datos     nunca se ha registrado un pago de esto
--
-- Pásame el resultado y lleno los que falten. O si prefieres, cada gasto fijo
-- tiene un lápiz en su pantalla y ahí está el campo del día.
-- =============================================================================

with uid as (
  select id from auth.users where email = 'camilo.zapatao2000@gmail.com'
),

-- Los cuatro que sembré yo el 8 de septiembre: su fecha es de relleno, no un
-- pago observado. Contarlos diría "te cobran el 8" sobre nada.
inventados as (
  select unnest(array[
    'tx-sep-icloud', 'tx-sep-disney', 'tx-sep-motilada', 'tx-sep-cuota-manejo'
  ]) as id
),

pagos as (
  select t.fixed_expense_id,
         extract(day from t.date)::int as dia,
         t.date
    from public.transactions t
   where t.user_id = (select id from uid)
     and t.fixed_expense_id is not null
     and t.id not in (select id from inventados)
)

select
  f.name                                              as gasto_fijo,
  f.due_day                                           as dia_actual,
  (select p.dia from pagos p
    where p.fixed_expense_id = f.id
    order by p.date desc limit 1)                     as dia_sugerido,
  (select count(*) from pagos p
    where p.fixed_expense_id = f.id)                  as pagos_vistos,
  (select string_agg(distinct p.dia::text, ', ' order by p.dia::text)
     from pagos p where p.fixed_expense_id = f.id)    as dias_observados,
  case
    when exists (select 1 from pagos p where p.fixed_expense_id = f.id) then 'historial'
    when f.id in ('fix-icloud', 'fix-disney', 'fix-motilada', 'fix-cuota-manejo')
      then 'aproximado (fecha que puse yo)'
    else 'sin datos'
  end                                                 as origen
from public.fixed_expenses f
where f.user_id = (select id from uid)
order by origen, f.name;
