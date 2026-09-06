-- =============================================================================
-- Comprobación de seguridad — córrelo DESPUÉS de schema.sql y schema-v2-plan-mensual.sql
--
-- Pégalo en el SQL Editor de Supabase y dale Run. No modifica nada, solo lee.
--
-- Tiene que devolver 16 filas y TODAS deben decir "OK". Si alguna dice
-- "SIN RLS" o "SIN POLITICA", esa tabla está abierta: cualquiera con la anon
-- key (que va en el código del navegador, o sea, pública) podría leer o
-- escribir los datos de todos los usuarios. En ese caso vuelve a correr
-- schema.sql y avisa.
-- =============================================================================

select
  c.relname                                as tabla,
  c.relrowsecurity                         as rls_activo,
  count(p.polname)                         as politicas,
  case
    when not c.relrowsecurity   then 'SIN RLS  <-- REVISAR'
    when count(p.polname) = 0   then 'SIN POLITICA  <-- REVISAR'
    else 'OK'
  end                                      as estado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in (
    -- schema.sql
    'user_settings', 'custom_categories', 'credit_cards', 'fixed_expenses',
    'debts', 'debt_payments', 'savings_goals', 'goal_contributions', 'transactions',
    -- schema-v2-plan-mensual.sql
    'people', 'income_sources', 'fixed_expense_shares', 'collections',
    'buckets', 'bucket_contributions', 'monthly_plans'
  )
group by c.relname, c.relrowsecurity
order by c.relname;

-- Si quieres ver la política de cada tabla en detalle:
--
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename;
