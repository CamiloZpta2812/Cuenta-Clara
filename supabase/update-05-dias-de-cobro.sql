-- =============================================================================
-- AlDía — el día de cobro de cada gasto fijo
--
-- NO BORRA NADA. Llena `due_day` donde esté vacío.
--
-- El día sale del historial, no de un número escrito acá: para cada gasto fijo
-- se toma el día del último pago que le hayas registrado. Derivarlo en vez de
-- transcribirlo evita el typo y deja el script correcto aunque los datos hayan
-- cambiado desde que lo escribí.
--
-- Dos cuidados:
--
--   Solo toca los que están en NULL. Si algún día corriges un día a mano,
--   volver a correr esto no te lo pisa.
--
--   Deja fuera los cuatro movimientos que sembré yo en update-04 con fecha del
--   8 de septiembre. Ese día es relleno mío; tomarlo como observación diría
--   "te cobran el 8" sobre un dato que me inventé, y esta vez con la
--   apariencia de venir de tus movimientos.
--
-- Quedan tres sin día y no hay de dónde sacarlo:
--
--   HBO Max y Spotify    no los has pagado, así que no hay historial
--   Cuota de manejo      solo tiene el movimiento que sembré yo
--
-- Esos tres se ponen a mano, con el lápiz de cada uno en Gastos fijos.
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
   * El día del último pago observado de cada gasto fijo.
   *
   * "El último" y no "el más repetido" porque con uno o dos pagos por gasto no
   * hay moda que valga; y si un cobro cambió de día, el reciente es el que
   * vale. iCloud es el único con dos —día 1 y día 28— y se queda con el 1.
   * Si en realidad te lo cobran el 28, corrígelo con el lápiz: la alerta mira
   * una ventana de 8 días, así que esa diferencia sí se nota.
   */
  update public.fixed_expenses f
     set due_day = u.dia
    from (
      select distinct on (t.fixed_expense_id)
             t.fixed_expense_id,
             extract(day from t.date)::int as dia
        from public.transactions t
       where t.user_id = uid
         and t.fixed_expense_id is not null
         and t.id not in ('tx-sep-icloud', 'tx-sep-disney',
                          'tx-sep-motilada', 'tx-sep-cuota-manejo')
       order by t.fixed_expense_id, t.date desc
    ) u
   where f.user_id = uid
     and f.id = u.fixed_expense_id
     and f.due_day is null;

  get diagnostics n = row_count;
  raise notice 'Gastos fijos con día de cobro puesto desde el historial: %.', n;

end $$;


-- =============================================================================
-- Informe: cómo quedaron, y cuáles siguen sin día
-- =============================================================================
with uid as (select current_setting('aldia.uid', true)::uuid as id)
select
  f.name                                    as gasto_fijo,
  f.due_day                                 as dia,
  coalesce(f.total_amount, f.amount)
    - coalesce((select sum(s.amount) from public.fixed_expense_shares s
                 where s.user_id = f.user_id and s.fixed_expense_id = f.id), 0)
                                            as tu_parte,
  case when f.due_day is null
       then 'PONLO A MANO'
       else 'listo' end                     as estado
from public.fixed_expenses f
where f.user_id = (select id from uid)
order by (f.due_day is null) desc, f.due_day, f.name;
