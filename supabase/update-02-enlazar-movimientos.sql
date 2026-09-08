-- =============================================================================
-- AlDía — enlazar los movimientos de septiembre con su gasto fijo
--
-- NO BORRA NADA. Solo pone la referencia que faltaba.
--
-- El problema: "Gimnasio", "Plan celular" y "Aporte a casa" se registraron a
-- mano, como gastos sueltos. La app no tiene forma de adivinar que ese
-- movimiento de 103.400 ES el gasto fijo del gimnasio: sin la referencia son
-- dos cosas distintas que coinciden en el monto.
--
-- Por eso el plan decía "faltan $746.000 de gastos fijos" y al mismo tiempo
-- contaba esos $457.300 como gasto variable. El mismo dinero, en la casilla
-- equivocada, restando dos veces.
--
-- De aquí en adelante esto no debería volver a pasar: en la pantalla de
-- Gastos fijos hay un botón para marcar uno como pagado, y ese sí deja el
-- movimiento enlazado solo.
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

  /*
   * El enlace se hace por nombre y mes, y solo sobre movimientos que hoy no
   * apuntan a nada. Así correrlo dos veces no cambia nada la segunda vez, y
   * nunca pisa un enlace que ya exista.
   */
  update public.transactions t
     set fixed_expense_id = v.fixed_id
    from (values
      ('Aporte a casa',  'fix-aporte-casa'),
      ('Gimnasio',       'fix-gimnasio'),
      ('Plan celular',   'fix-celular')
    ) as v(nota, fixed_id)
   where t.user_id = uid
     and t.month = '2026-09'
     and t.fixed_expense_id is null
     and lower(t.note) = lower(v.nota);

  get diagnostics n = row_count;
  raise notice 'Movimientos enlazados a su gasto fijo: %.', n;

  /*
   * Los abonos a las deudas viejas (Doña Natalia, Sofi) se quedan como están.
   *
   * No se enlazan al libre inversión porque no fueron pagos A ese crédito:
   * fueron pagos HECHOS CON ese crédito. Enlazarlos diría que ya abonaste
   * 1.750.000 a Bancolombia, y no es cierto.
   *
   * Con la categoría "deudas" ya es suficiente: el motor sabe que abonar no es
   * gastar, y los saca del gasto variable.
   */

end $$;


-- =============================================================================
-- Informe: cómo queda septiembre
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id),
mov as (
  select * from public.transactions
   where user_id = (select id from uid) and month = '2026-09' and type = 'gasto'
)
select linea, valor from (
  select 1 as n, 'Gastos fijos pagados' as linea,
         coalesce(sum(amount), 0) as valor from mov where fixed_expense_id is not null
  union all
  select 2, 'Abonos a deuda',
         coalesce(sum(amount), 0) from mov where category = 'deudas'
  union all
  select 3, 'Gasto variable real',
         coalesce(sum(amount), 0) from mov
   where fixed_expense_id is null and category <> 'deudas'
     and debt_id is null and bucket_id is null
) x order by n;
