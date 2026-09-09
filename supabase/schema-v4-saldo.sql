-- =============================================================================
-- AlDía — el ancla del saldo
--
-- NO BORRA NADA. Agrega dos columnas a `user_settings`.
--
-- El problema que resuelve: la app no nació con tu cuenta bancaria. Los
-- movimientos empiezan el día que la instalaste, así que sumarlos desde cero
-- daba la VARIACIÓN desde entonces, no lo que hay en el banco. La gráfica del
-- pulso lo confesaba en letra pequeña ("arranca en cero porque no sabemos con
-- cuánto empezaste"), lo cual era honesto pero inútil: la pregunta de la
-- mañana no es "cuánto me he movido", es "cuánto tengo".
--
-- El ancla es una frase: "el 8 de septiembre cerré con tanto". De ahí en
-- adelante la app sigue el saldo sola. Cuando se desfase —una transferencia
-- que no registraste— se vuelve a anclar, y la historia vieja no hay que
-- reconstruirla: queda absorbida dentro del número.
--
-- Van dos columnas y no un jsonb porque el ancla es un dato que se consulta,
-- no una preferencia. Y van las dos juntas o ninguna: un monto sin fecha no
-- diría de qué día es, y un cero SÍ es un ancla válida —"hoy no tengo nada" es
-- una medición, no la falta de una—, así que lo que distingue "hay ancla" de
-- "no hay" es la fecha, nunca el monto.
-- =============================================================================

alter table public.user_settings
  add column if not exists balance_anchor_date   date,
  add column if not exists balance_anchor_amount numeric;

/*
 * La fecha manda: sin ella el monto no significa nada, así que la base no deja
 * que quede uno solo de los dos. Sin esto, un guardado a medias dejaría un
 * saldo flotando sin día y la app lo leería como "no hay ancla" mientras la
 * tabla dice que sí.
 */
alter table public.user_settings
  drop constraint if exists user_settings_balance_anchor_completa;

alter table public.user_settings
  add constraint user_settings_balance_anchor_completa
  check ((balance_anchor_date is null) = (balance_anchor_amount is null));
