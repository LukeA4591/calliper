
UPDATE auth.users
SET
    raw_user_meta_data =
        jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            '"manufacturer"'
        ),
    updated_at = now()
WHERE email LIKE 'demo%@calliper.example';
