-- =============================================================================
-- AlDía — cuándo entra y cuándo sale
--
-- REQUISITO: haber corrido antes `update-05-dias-de-cobro.sql` y
-- `schema-v6-calendario.sql`.
--
-- NO BORRA NADA.
--
-- Pone las cuatro fechas que le faltaban al calendario:
--
--   el sueldo, partido en sus dos quincenas (15 y 30)
--   el Club Aletas, que cae en los primeros días
--   la cuota del crédito, que Bancolombia cobra el 8
--   el día en que apartas los ahorros y colchones
--
-- Con eso la pantalla de Quincenas puede decir algo: hasta ahora sabía CUÁNTO
-- entra y cuánto sale, pero no CUÁNDO, y sin eso un mes que cuadra perfecto
-- puede dejarte sin plata el día 9.
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

  if to_regclass('public.income_sources') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'income_sources'
                       and column_name = 'starts_period') then
    raise exception 'Falta correr schema-v6-calendario.sql antes que este.';
  end if;

  -- ===========================================================================
  -- 1. El sueldo, partido en dos quincenas
  --
  -- `expected` es mensual, así que una sola fila no puede decir "1.700.000 el
  -- 15 y 1.700.000 el 30". Se parte en dos fuentes. No hace falta inventar un
  -- concepto de frecuencia: dos filas ya lo dicen todo, y de paso dejan
  -- describir un mes con entradas irregulares.
  --
  -- La fila vieja se REUSA como la primera quincena en vez de borrarla y crear
  -- dos: `transactions.income_source_id` puede estar apuntándole, y borrarla
  -- dejaría esos movimientos señalando algo que ya no existe.
  -- ===========================================================================
  update public.income_sources
     set name = 'Salario 1ª quincena', expected = 1700000,
         day = 15, starts_period = true
   where user_id = uid and id = 'inc-salario';

  insert into public.income_sources
    (user_id, id, name, expected, variable, active, day, starts_period)
  values
    (uid, 'inc-salario-q2', 'Salario 2ª quincena', 1700000, true, true, 30, true)
  on conflict (user_id, id) do update
    set name = excluded.name, expected = excluded.expected,
        day = excluded.day, starts_period = excluded.starts_period;

  -- ===========================================================================
  -- 2. El Club Aletas
  --
  -- Lo pagan en los primeros cinco días. Se pone el 5 —el extremo tardío— por
  -- prudencia: si el calendario se equivoca, que sea diciendo que la plata
  -- llega después y no antes.
  --
  -- `starts_period` queda en false a propósito. Son 200.000 y tomarlos como
  -- frontera partiría el mes en pedazos que no corresponden a nada: el
  -- arriendo del 1 en un tramo y la cuota del 8 en otro, escondiendo justo la
  -- concentración que la pantalla existe para mostrar. Un ingreso chico cae
  -- DENTRO de una quincena, no la abre.
  -- ===========================================================================
  update public.income_sources
     set day = 5, starts_period = false
   where user_id = uid and id = 'inc-club-aletas';

  -- ===========================================================================
  -- 3. La cuota del crédito
  --
  -- El 8, y ahí está el nudo del mes: cae en la misma quincena que los gastos
  -- fijos de la primera semana, así que entre el 1 y el 8 se va la mitad del
  -- sueldo del 30.
  -- ===========================================================================
  update public.debts
     set due_day = 8
   where user_id = uid and id = 'debt-libre-inversion';

  -- ===========================================================================
  -- 4. Cuándo apartas
  --
  -- El 15, que es como lo vienes haciendo. De las cuatro fechas de arriba esta
  -- es la única que decides tú solo, sin negociarla con el banco, con la casa
  -- ni con el gimnasio — así que es la palanca con la que se equilibra un mes
  -- torcido. La pantalla de Quincenas existe sobre todo para saber cuándo vale
  -- la pena moverla.
  --
  -- La cooperativa se queda sin día: no sé si te la descuentan de nómina o la
  -- pones tú. Va a aparecer en "Sin fecha todavía" hasta que se lo pongas.
  -- ===========================================================================
  update public.buckets
     set deposit_day = 15
   where user_id = uid
     and moves_cash
     and id <> 'bkt-cooperativa';

  /*
   * El fondo con Sofi lo pagas en dos mitades —150.000 el 15 y 150.000 el 30—
   * y un bucket solo tiene un día de aporte, así que el calendario lo va a
   * mostrar entero el 15. Carga de más esa quincena y de menos la otra, justo
   * en la cifra que la pantalla mide. Si te sirve, le agrego aportes partidos.
   */

  raise notice 'Listo. Sueldo en dos quincenas (15 y 30), club el 5, cuota el 8, aportes el 15.';
end $$;


-- =============================================================================
-- Informe: el calendario que queda
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id)
select * from (
  select 1 as orden, coalesce(day, 99) as dia, name as concepto,
         expected as monto,
         case when starts_period then 'abre quincena' else 'entra' end as tipo
    from public.income_sources
   where user_id = (select id from uid) and active

  union all
  select 2, coalesce(f.due_day, 99), f.name,
         -(coalesce(f.total_amount, f.amount)
           - coalesce((select sum(s.amount) from public.fixed_expense_shares s
                        where s.user_id = f.user_id and s.fixed_expense_id = f.id), 0)),
         'gasto fijo'
    from public.fixed_expenses f where f.user_id = (select id from uid)

  union all
  select 3, coalesce(due_day, 99), name, -fixed_payment, 'cuota'
    from public.debts where user_id = (select id from uid)

  union all
  select 4, coalesce(b.deposit_day, 99), b.name,
         -(b.monthly_amount
           - coalesce((select sum(s.amount) from public.bucket_shares s
                        where s.user_id = b.user_id and s.bucket_id = b.id), 0)),
         case when b.moves_cash then 'apartas' else 'reserva (sin fecha)' end
    from public.buckets b where b.user_id = (select id from uid)
) x
order by case when dia = 99 then 1 else 0 end, dia, orden;
