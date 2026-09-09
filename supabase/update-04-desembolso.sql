-- =============================================================================
-- AlDía — el desembolso del 8 de septiembre
--
-- REQUISITO: haber corrido antes `update-03-compartidos-y-gasolina.sql` y
-- `schema-v4-saldo.sql`.
--
-- NO BORRA NADA.
--
-- Qué pasó el 8 de septiembre: entraron los 14.000.000 del libre inversión y
-- con ellos quedó en cero la tarjeta de crédito. Hoy, 9 de septiembre, la
-- cuenta está en cero.
--
-- Ni el desembolso ni el pago de la tarjeta entran como movimientos, a
-- propósito:
--
--   El desembolso no es un ingreso. Un ingreso es plata que te ganaste; esta
--   es plata que debes, y ya está contada como deuda. Meterla en la línea de
--   ingresos diría que en septiembre te entraron 17.600.000, y arruinaría toda
--   comparación contra el plan de aquí en adelante.
--
--   El pago de la tarjeta tampoco es un gasto de septiembre. Lo que compraste
--   con la tarjeta ya se gastó en su mes; pagar la factura solo mueve la deuda
--   de un lado a otro. Cargarlo a septiembre contaría dos veces las mismas
--   compras.
--
-- Las dos cosas sí movieron la cuenta, y el ancla del saldo es exactamente la
-- herramienta para eso: en vez de reconstruir la historia, dice "el 8 de
-- septiembre cerré en cero" y todo lo anterior queda absorbido adentro.
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
  -- 1. El saldo en cuenta
  --
  -- Se ancla al 8 y no al 9 a propósito: el ancla es el saldo con el que CERRÓ
  -- ese día, así que lo que registres hoy sí baja la línea. Anclarlo al 9
  -- volvería invisible cualquier gasto de hoy que anotes más tarde.
  -- ===========================================================================
  insert into public.user_settings (user_id, balance_anchor_date, balance_anchor_amount)
  values (uid, date '2026-09-08', 0)
  on conflict (user_id) do update
    set balance_anchor_date   = excluded.balance_anchor_date,
        balance_anchor_amount = excluded.balance_anchor_amount,
        updated_at            = now();

  -- ===========================================================================
  -- 2. La deuda
  --
  -- El saldo ya estaba en 14.000.000 desde la siembra. Lo que cambia es la
  -- fecha: estaba puesta en el 1 de septiembre como provisional, y de ahí
  -- salía que la primera cuota fuera de septiembre. Con la fecha real —el 8—
  -- la primera cuota cae en octubre, que es cuando de verdad empiezas a pagar.
  -- ===========================================================================
  update public.debts
     set start_date      = date '2026-09-08',
         total_amount    = 14000000,
         current_balance = 14000000
   where user_id = uid and id = 'debt-libre-inversion';

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No encontré la deuda debt-libre-inversion. Corre primero seed-plan-mensual.sql.';
  end if;

  -- ===========================================================================
  -- 3. Los gastos fijos que ya pagaste
  --
  -- Faltaban cuatro por enlazar; los otros tres (aporte a casa, gimnasio, plan
  -- celular) quedaron en update-02. Los únicos pendientes son HBO y Spotify.
  --
  -- El monto es TU parte, no el total del servicio: de Spotify pagas 6.100 y
  -- los otros cuatro ponen el resto.
  --
  -- La fecha es aproximada —el 8— porque lo que importa es el mes: es contra
  -- el mes que se juzga el plan. Y al caer sobre el ancla, ninguno de estos
  -- pagos vuelve a descontarse del saldo: ya están dentro del cero.
  -- ===========================================================================
  insert into public.transactions
    (user_id, id, type, amount, category, date, month, note,
     payment_method, fixed_expense_id, is_fixed)
  values
    (uid, 'tx-sep-icloud',       'gasto', 11300, 'servicios',       date '2026-09-08', '2026-09', 'iCloud',                  'debito', 'fix-icloud',       true),
    (uid, 'tx-sep-disney',       'gasto', 12000, 'entretenimiento', date '2026-09-08', '2026-09', 'Disney+',                 'debito', 'fix-disney',       true),
    (uid, 'tx-sep-motilada',     'gasto', 40000, 'otros_gasto',     date '2026-09-08', '2026-09', 'Corte de cabello',        'debito', 'fix-motilada',     true),
    (uid, 'tx-sep-cuota-manejo', 'gasto', 51000, 'servicios',       date '2026-09-08', '2026-09', 'Cuota de manejo tarjeta', 'debito', 'fix-cuota-manejo', true)
  on conflict (user_id, id) do update
    set amount = excluded.amount, date = excluded.date, month = excluded.month,
        fixed_expense_id = excluded.fixed_expense_id, is_fixed = excluded.is_fixed;

  /*
   * Los días de cobro (due_day) siguen vacíos, y por eso "Esta semana te
   * cobran" sale en blanco: la pantalla tiene el dato pero nadie se lo ha
   * dado. No los pongo por SQL porque me los estaría inventando — en Gastos
   * fijos cada uno tiene su campo de día.
   */

  -- ===========================================================================
  -- 4. El plan de septiembre, sin la cuota de la deuda
  --
  -- La cuota de 446.413 estaba restando en septiembre y no debería: el crédito
  -- se desembolsó el 8 y la primera cuota es de octubre. Con ella adentro, el
  -- plan se cobraba a sí mismo un mes que el banco nunca cobró.
  --
  -- Mientras el mes esté abierto la app ya no la cuenta —lo deduce sola de la
  -- fecha de desembolso—, así que esta línea no cambia lo que ves hoy. Importa
  -- el día que septiembre se cierre: al cerrarse, el plan deja de recalcularse
  -- y se juzga contra estos números guardados. Sin esto quedaría congelada una
  -- cuota inexistente.
  -- ===========================================================================
  update public.monthly_plans
     set debt_payment = 0, updated_at = now()
   where user_id = uid and month = '2026-09';

  raise notice 'Listo. Saldo anclado en 0 al 8 de septiembre, deuda desde esa fecha, cuatro fijos enlazados.';
end $$;


-- =============================================================================
-- Informe: qué tiene que cubrir la quincena del 15
--
-- Todo sale de las tablas, no de números escritos a mano: si algún monto
-- cambió desde que se escribió esto, el informe lo refleja en vez de mentir.
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id),

-- Tu parte de los gastos fijos que todavía no tienen movimiento en septiembre.
fijos_pendientes as (
  select f.name,
         coalesce(f.total_amount, f.amount)
         - coalesce((select sum(s.amount) from public.fixed_expense_shares s
                      where s.user_id = f.user_id and s.fixed_expense_id = f.id), 0) as tu_parte
    from public.fixed_expenses f
   where f.user_id = (select id from uid)
     and not exists (select 1 from public.transactions t
                      where t.user_id = f.user_id
                        and t.fixed_expense_id = f.id
                        and t.month = '2026-09')
),

-- Tu parte de lo que hay que apartar. Las reservas quedan fuera: la gasolina
-- no se aparta, se va gastando, así que no es plata que haya que mover el 15.
--
-- OJO con la cooperativa: aparece acá porque es una meta que mueve plata, pero
-- si te la descuentan de la nómina ya viene restada de los 1.700.000 y estaría
-- contada dos veces. Si es así, dime y la marco como descuento de nómina.
buckets_pendientes as (
  select b.name,
         b.monthly_amount
         - coalesce((select sum(s.amount) from public.bucket_shares s
                      where s.user_id = b.user_id and s.bucket_id = b.id), 0) as tu_parte
    from public.buckets b
   where b.user_id = (select id from uid)
     and b.moves_cash
     and not exists (select 1 from public.bucket_contributions c
                      where c.user_id = b.user_id and c.bucket_id = b.id
                        and to_char(c.date, 'YYYY-MM') = '2026-09')
)

select concepto, monto from (
  select 1 as n, 'QUINCENA DEL 15 (estimada)' as concepto, 1700000::numeric as monto
  union all select 2, '- ' || name, -tu_parte from fijos_pendientes
  union all select 3, '- ' || name, -tu_parte from buckets_pendientes
  union all select 4, '- Deudas pequeñas (van como movimientos)', -750000
  union all select 5, 'TE QUEDA PARA EL RESTO DEL MES',
    1700000
    - coalesce((select sum(tu_parte) from fijos_pendientes), 0)
    - coalesce((select sum(tu_parte) from buckets_pendientes), 0)
    - 750000
) x order by n, concepto;
