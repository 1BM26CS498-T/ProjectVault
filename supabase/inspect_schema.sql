-- ProjectVault: Inspect existing database tables and columns

SELECT
    t.tablename,
    c.column_name,
    c.data_type,
    c.is_nullable,
    pg_catalog.col_description(
        nc.oid, c.ordinal_position
    ) AS column_description
FROM pg_tables t
JOIN information_schema.columns c
    ON t.tablename = c.table_name
    AND t.schemaname = c.table_schema
JOIN pg_namespace ns
    ON ns.nspname = t.schemaname
JOIN pg_class nc
    ON nc.relname = t.tablename
    AND nc.relnamespace = ns.oid
WHERE t.schemaname = 'public'
ORDER BY t.tablename, c.ordinal_position;

-- Check RLS status

SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
ORDER BY relname;

-- List RLS policies

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- List foreign key relationships

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
