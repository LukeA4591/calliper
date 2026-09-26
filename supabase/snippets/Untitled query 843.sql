BEGIN;

TRUNCATE TABLE
    public.ideas,
    public.analyses,
    public.machines,
    public.manufacturer_profiles,
    public.account_roles
RESTART IDENTITY CASCADE;

DELETE FROM auth.users;

COMMIT;