-- =============================================================================
-- AlDía — cuándo entra y cuándo sale
--
-- NO BORRA NADA. Agrega dos columnas.
--
-- La app sabía CUÁNTO entra y cuánto sale, pero no CUÁNDO. Con eso alcanza
-- para juzgar un mes cerrado y no alcanza para vivirlo: el mes puede cuadrar
-- perfecto y aun así dejarte sin plata el día 9, porque la mitad de los
-- gastos fijos cae en la primera semana y el sueldo llega en dos pedazos.
--
-- Los gastos fijos y las deudas ya tenían `due_day`. Faltaban los dos lados
-- que quedan:
--
--   income_sources.day    qué día cae cada entrada. De aquí salen también las
--                         fronteras de las quincenas: una quincena es el
--                         tiempo entre un pago y el siguiente, así que no hay
--                         que configurarla aparte — se deduce de cuándo te
--                         pagan.
--
--   buckets.deposit_day   qué día apartas. Es el único de los cuatro que
--                         decides tú solo, sin negociar con nadie, y por eso
--                         es la palanca con la que se equilibra un mes
--                         desbalanceado.
--
-- Las dos son opcionales. Lo que no tenga día no se inventa: aparece aparte,
-- en un "sin fecha", que es honesto y además hace visible el dato que falta.
--
-- OJO con un sueldo quincenal: `expected` es mensual y una sola fila no puede
-- decir "1.700.000 el 15 y 1.700.000 el 30". Se parte en dos fuentes, una por
-- quincena. No hace falta un concepto de frecuencia: dos filas ya lo dicen
-- todo, y de paso dejan describir un mes con entradas irregulares.
-- =============================================================================

alter table public.income_sources
  add column if not exists day int;

alter table public.income_sources
  drop constraint if exists income_sources_day_valido;
alter table public.income_sources
  add constraint income_sources_day_valido
  check (day is null or day between 1 and 31);

alter table public.buckets
  add column if not exists deposit_day int;

alter table public.buckets
  drop constraint if exists buckets_deposit_day_valido;
alter table public.buckets
  add constraint buckets_deposit_day_valido
  check (deposit_day is null or deposit_day between 1 and 31);

/*
 * No todo ingreso abre una quincena.
 *
 * La primera versión sacaba las fronteras de TODOS los días de ingreso, y el
 * Club Aletas —200.000 que caen el 5— partía el mes en tres pedazos que no
 * corresponden a nada: dejaba el arriendo del 1 en un tramo y la cuota del 8
 * en otro, escondiendo justo la concentración que la pantalla existe para
 * mostrar.
 *
 * Una quincena la abre el sueldo. Lo demás cae adentro.
 *
 * Si no hay ninguna marcada, se usan todos los días de ingreso: es mejor un
 * calendario aproximado que una pantalla vacía, y así funciona antes de que
 * nadie configure nada.
 */
alter table public.income_sources
  add column if not exists starts_period boolean not null default false;
