-- =============================================================================
-- AlDía — siembra del plan mensual
--
-- REQUISITO: haber corrido antes `schema.sql` y `schema-v2-plan-mensual.sql`.
--
-- NO BORRA NADA. Todo entra con `on conflict do update`, así que se puede
-- correr las veces que haga falta: la segunda vez actualiza en vez de duplicar.
--
-- Al final imprime un informe con lo que quedó, para que puedas ver de una si
-- había datos viejos que ahora sobran (por ejemplo, "Mantenimiento Moto" como
-- gasto fijo, que en este modelo es un colchón).
-- =============================================================================

do $$
declare
  /*
   * La cuenta con la que entras a AlDía, que no es la misma con la que entras
   * al dashboard de Supabase. Si algún día queda una sola cuenta en el
   * proyecto, se puede dejar vacío y el script la encuentra solo.
   */
  correo   text := 'camilo.zapatao2000@gmail.com';
  uid      uuid;
  usuarios int;
  deudas   int;
begin

  select count(*) into usuarios from auth.users;

  if correo <> '' then
    select id into uid from auth.users where email = correo;
    if uid is null then
      raise exception 'No hay ningún usuario con el correo %. Corre: select email from auth.users;', correo;
    end if;
  elsif usuarios = 1 then
    select id into uid from auth.users;
  elsif usuarios = 0 then
    raise exception 'No hay usuarios registrados. Entra una vez a la app antes de sembrar.';
  else
    raise exception 'Hay % cuentas (%). Pon en la variable `correo` de arriba la que usas en AlDía.',
      usuarios, (select string_agg(email, ', ' order by email) from auth.users);
  end if;

  /*
   * El usuario resuelto queda guardado en la sesión para que el informe del
   * final no tenga que volver a averiguarlo. Antes el correo había que
   * escribirlo en dos sitios, y escribirlo en uno solo dejaba el informe vacío.
   *
   * Es un ajuste de sesión, no una tabla: no crea nada en la base, se borra al
   * cerrar la conexión y nadie más lo ve.
   */
  perform set_config('aldia.uid', uid::text, false);

  -- ===========================================================================
  -- 1. Las personas a las que les cobras
  -- ===========================================================================
  insert into public.people (user_id, id, name) values
    (uid, 'p-juanjo', 'Juanjo'),
    (uid, 'p-yeison', 'Yeison'),
    (uid, 'p-andy',   'Andy'),
    (uid, 'p-paula',  'Paula'),
    (uid, 'p-alex',   'Alex')
  on conflict (user_id, id) do update set name = excluded.name;

  -- ===========================================================================
  -- 2. Fuentes de ingreso
  --
  -- El monto es lo que ESPERAS, no lo que entró. Lo que entró de verdad son
  -- movimientos de tipo ingreso, y la app compara los dos.
  -- ===========================================================================
  insert into public.income_sources (user_id, id, name, expected, variable, active) values
    (uid, 'inc-salario',      'Salario',     3400000, true, true),
    (uid, 'inc-club-aletas',  'Club Aletas',  200000, true, true)
  on conflict (user_id, id) do update
    set name = excluded.name, expected = excluded.expected,
        variable = excluded.variable, active = excluded.active;

  -- ===========================================================================
  -- 3. Gastos fijos
  --
  -- `total_amount` es el valor completo del servicio. `amount` es tu parte, y
  -- está solo porque las pantallas viejas todavía la leen: la cifra que manda
  -- es total menos el reparto de la tabla de abajo.
  --
  -- Mantenimiento Moto NO está aquí a propósito: es un colchón (punto 5).
  -- ===========================================================================
  insert into public.fixed_expenses
    (user_id, id, name, category, amount, total_amount, payment_method) values
    (uid, 'fix-hbo',         'HBO Max',      'entretenimiento',   8300,  12450, 'debito'),
    (uid, 'fix-spotify',     'Spotify',      'entretenimiento',   6100,  30500, 'debito'),
    (uid, 'fix-icloud',      'iCloud',       'servicios',        11300,  11300, 'debito'),
    (uid, 'fix-disney',      'Disney+',      'entretenimiento',  12000,  12000, 'debito'),
    (uid, 'fix-celular',     'Plan Celular', 'servicios',        53900,  53900, 'debito'),
    (uid, 'fix-motilada',    'Corte de cabello', 'otros_gasto',  40000,  40000, 'debito'),
    (uid, 'fix-aporte-casa', 'Aporte Casa',  'vivienda',        300000, 300000, 'debito'),
    (uid, 'fix-gimnasio',    'Gimnasio',     'salud',           103400, 103400, 'debito'),
    (uid, 'fix-gasolina',    'Gasolina',     'transporte',      160000, 160000, 'debito'),
    (uid, 'fix-cuota-manejo','Cuota de manejo tarjeta', 'servicios', 51000, 51000, 'debito')
  on conflict (user_id, id) do update
    set name = excluded.name, category = excluded.category,
        amount = excluded.amount, total_amount = excluded.total_amount,
        payment_method = excluded.payment_method;

  -- ===========================================================================
  -- 4. El reparto
  --
  -- Tu parte no se guarda: HBO son 12.450 y Juanjo pone 4.150, así que lo tuyo
  -- son 8.300 porque se resta, no porque esté escrito en algún lado. Si mañana
  -- entra alguien más al HBO, tu parte baja sola.
  -- ===========================================================================
  insert into public.fixed_expense_shares (user_id, id, fixed_expense_id, person_id, amount) values
    (uid, 'shr-hbo-juanjo',     'fix-hbo',     'p-juanjo', 4150),
    (uid, 'shr-spotify-yeison', 'fix-spotify', 'p-yeison', 6100),
    (uid, 'shr-spotify-andy',   'fix-spotify', 'p-andy',   6100),
    (uid, 'shr-spotify-paula',  'fix-spotify', 'p-paula',  6100),
    (uid, 'shr-spotify-alex',   'fix-spotify', 'p-alex',   6100)
  on conflict (user_id, id) do update
    set fixed_expense_id = excluded.fixed_expense_id,
        person_id = excluded.person_id, amount = excluded.amount;

  -- ===========================================================================
  -- 5. Buckets: metas y colchones
  --
  --   meta     tiene un destino: llegar a un monto
  --   colchon  no es ahorro con destino, es plata apartada para lo que llegue
  --
  --   liquid = false: está ahí pero no lo puedes tocar (la cooperativa)
  --
  -- Los gatos y la moto son colchones, no gastos fijos: no salen cada mes, se
  -- guardan cada mes para el mes en que sí salgan.
  -- ===========================================================================
  insert into public.buckets (user_id, id, name, kind, liquid, monthly_amount) values
    (uid, 'bkt-ahorro-1',    'Ahorro personal 1',    'meta',    true,   50000),
    (uid, 'bkt-ahorro-2',    'Ahorro personal 2',    'meta',    true,  300000),
    (uid, 'bkt-cooperativa', 'Cooperativa',          'meta',    false,  76000),
    (uid, 'bkt-gatos',       'Colchón gatos',        'colchon', true,   65000),
    (uid, 'bkt-moto',        'Colchón moto',         'colchon', true,  100000),
    (uid, 'bkt-seguridad',   'Colchón de seguridad', 'colchon', true,  300000)
  on conflict (user_id, id) do update
    set name = excluded.name, kind = excluded.kind,
        liquid = excluded.liquid, monthly_amount = excluded.monthly_amount;

  -- ===========================================================================
  -- 6. La deuda
  --
  -- Si ya tenías una deuda registrada, se le completan los campos nuevos en vez
  -- de crear otra al lado. Si tenías varias, no se toca ninguna: no hay forma
  -- de adivinar cuál es el libre inversión.
  -- ===========================================================================
  select count(*) into deudas from public.debts where user_id = uid;

  if deudas = 0 then
    insert into public.debts (
      user_id, id, name, total_amount, interest_rate, monthly_payment,
      start_date, currency, fixed_payment, payoff_mode, current_balance
    ) values (
      uid, 'debt-libre-inversion', 'Libre inversión Bancolombia',
      14000000,        -- saldo de hoy; si quieres el monto original, cámbialo
      1.67,            -- porcentaje MENSUAL, como lo reporta el banco
      446413,
      date_trunc('month', current_date)::date,   -- <-- PROVISIONAL, ver abajo
      'COP', 446413, 'reducir-plazo', 14000000
    );
    raise notice 'Deuda creada. Ojo: start_date quedó provisional.';

  elsif deudas = 1 then
    update public.debts set
      interest_rate   = 1.67,
      monthly_payment = 446413,
      fixed_payment   = 446413,
      payoff_mode     = 'reducir-plazo',
      current_balance = 14000000
    where user_id = uid;
    raise notice 'Ya tenías una deuda: se le completaron los campos nuevos.';

  else
    raise notice 'Tienes % deudas. No se tocó ninguna: dime cuál es el libre inversión.', deudas;
  end if;

  -- ===========================================================================
  -- 7. El plan de este mes
  --
  -- Es la foto contra la que se juzga el mes. Los meses que pasen se marcan
  -- como cerrados y ya no se recalculan.
  --
  --   3.600.000  ingresos
  --   −  746.000  gastos fijos (tu parte, cuota de manejo incluida)
  --   −  446.413  cuota de la deuda
  --   −  426.000  metas (los dos ahorros + cooperativa)
  --   −  830.000  gasto variable estimado
  --   = 1.151.587  excedente bruto
  --   −  465.000  colchones (gatos + moto + seguridad)
  --   =  686.587  disponible para abonarle de más a la deuda
  -- ===========================================================================
  insert into public.monthly_plans (
    user_id, month, expected_income, fixed_expenses, debt_payment,
    savings, variable_estimate, cushion, locked
  ) values (
    uid, to_char(current_date, 'YYYY-MM'),
    3600000, 746000, 446413, 426000, 830000, 465000, false
  )
  on conflict (user_id, month) do update
    set expected_income   = excluded.expected_income,
        fixed_expenses    = excluded.fixed_expenses,
        debt_payment      = excluded.debt_payment,
        savings           = excluded.savings,
        variable_estimate = excluded.variable_estimate,
        cushion           = excluded.cushion,
        updated_at        = now();

  raise notice 'Siembra lista.';
end $$;


-- =============================================================================
-- Informe: qué quedó
--
-- Mira sobre todo la sección de gastos fijos. Si aparece algo que ya no debería
-- estar ahí —"Mantenimiento Moto", "Cooperativa", "Colchón"— es un dato viejo
-- del modelo anterior y lo puedes borrar desde la app.
-- =============================================================================
/*
 * El usuario que resolvió el bloque de arriba. Con `true`, si este informe se
 * corre suelto devuelve vacío en vez de un error que no explica nada.
 */
with uid as (select current_setting('aldia.uid', true)::uuid as id)
select 'personas' as que, name as detalle, null::numeric as valor
  from public.people where user_id = (select id from uid)
union all
select 'ingreso', name, expected
  from public.income_sources where user_id = (select id from uid)
union all
select 'gasto fijo', f.name || ' (tuyo: ' ||
       (coalesce(f.total_amount, f.amount)
         - coalesce((select sum(s.amount) from public.fixed_expense_shares s
                      where s.user_id = f.user_id and s.fixed_expense_id = f.id), 0))::text || ')',
       coalesce(f.total_amount, f.amount)
  from public.fixed_expenses f where f.user_id = (select id from uid)
union all
select 'reparto', p.name || ' — ' || f.name, s.amount
  from public.fixed_expense_shares s
  join public.people p on p.user_id = s.user_id and p.id = s.person_id
  join public.fixed_expenses f on f.user_id = s.user_id and f.id = s.fixed_expense_id
  where s.user_id = (select id from uid)
union all
select case when b.kind = 'colchon' then 'colchón' else 'meta' end,
       b.name || case when b.liquid then '' else ' (no líquido)' end, b.monthly_amount
  from public.buckets b where b.user_id = (select id from uid)
union all
select 'deuda', d.name || ' — cuota ' || d.fixed_payment::text || ' al ' || d.interest_rate::text || '% mensual',
       d.current_balance
  from public.debts d where d.user_id = (select id from uid)
union all
select 'plan ' || m.month, 'disponible para abono extra',
       m.expected_income - m.fixed_expenses - m.debt_payment - m.savings
         - m.variable_estimate - m.cushion
  from public.monthly_plans m where m.user_id = (select id from uid)
order by que, detalle;
