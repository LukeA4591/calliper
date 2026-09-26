-- Roles are captured once at signup; later user_metadata edits cannot change access.
create table public.account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('designer','manufacturer')),
  created_at timestamptz not null default now()
);
alter table public.account_roles enable row level security;
revoke all on public.account_roles from anon, authenticated;
grant select on public.account_roles to authenticated;
create function public.capture_account_role() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_roles(user_id, role) values(new.id,
    case when new.raw_user_meta_data->>'account_type' = 'manufacturer' then 'manufacturer' else 'designer' end);
  return new;
end $$;
revoke all on function public.capture_account_role() from public, anon, authenticated;
create trigger capture_account_role after insert on auth.users for each row execute function public.capture_account_role();
insert into public.account_roles(user_id,role) select id,'designer' from auth.users on conflict do nothing;
-- Consult the live user row, not editable metadata or stale JWT role claims.
create function public.verified_account_role() returns text language sql stable security definer set search_path = '' as $$
  select r.role from public.account_roles r join auth.users u on u.id=r.user_id
  where r.user_id=(select auth.uid()) and u.email_confirmed_at is not null
$$;
revoke all on function public.verified_account_role() from public, anon;
grant execute on function public.verified_account_role() to authenticated;
create policy "Own verified role" on public.account_roles for select to authenticated
  using (user_id=(select auth.uid()) and (select public.verified_account_role()) is not null);

create table public.manufacturer_profiles (
  user_id uuid primary key references public.account_roles(user_id) on delete cascade,
  business_name text not null check (length(btrim(business_name)) between 1 and 160),
  contact_email text not null check (length(contact_email) between 3 and 254 and position('@' in contact_email)>1),
  contact_phone text not null default '' check (length(contact_phone)<=60),
  location text not null check (length(btrim(location)) between 1 and 240),
  description text not null default '' check (length(description)<=2000),
  processes text[] not null default '{}' check (processes <@ array['cnc_milling_3_axis','cnc_milling_5_axis','cnc_turning','laser_cutting','waterjet_cutting','additive_manufacturing']::text[]),
  materials text[] not null default '{}' check (cardinality(materials)<=30),
  max_x_mm numeric check (max_x_mm>0 and max_x_mm<=1000000),
  max_y_mm numeric check (max_y_mm>0 and max_y_mm<=1000000),
  max_z_mm numeric check (max_z_mm>0 and max_z_mm<=1000000),
  tolerance_mm numeric check (tolerance_mm>0 and tolerance_mm<=1000),
  capacity_notes text not null default '' check (length(capacity_notes)<=1000),
  limitations text not null default '' check (length(limitations)<=2000),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.machines (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  brand text not null default '' check (length(brand)<=120),
  model text not null default '' check (length(model)<=120),
  category text not null check (category in ('cnc_milling_3_axis','cnc_milling_5_axis','cnc_turning','laser_cutting','waterjet_cutting','additive_manufacturing')),
  processes text[] not null check (cardinality(processes) between 1 and 6 and processes <@ array['cnc_milling_3_axis','cnc_milling_5_axis','cnc_turning','laser_cutting','waterjet_cutting','additive_manufacturing']::text[]),
  materials text[] not null default '{}' check (cardinality(materials)<=30),
  max_x_mm numeric check (max_x_mm>0 and max_x_mm<=1000000),
  max_y_mm numeric check (max_y_mm>0 and max_y_mm<=1000000),
  max_z_mm numeric check (max_z_mm>0 and max_z_mm<=1000000),
  tolerance_mm numeric check (tolerance_mm>0 and tolerance_mm<=1000),
  special_capabilities text[] not null default '{}' check (special_capabilities <@ array['internal_pockets','blind_holes','internal_corners','thin_walls','deep_holes','threads','heat_treatment','anodizing','surface_grinding','inspection_report']::text[]),
  notes text not null default '' check (length(notes)<=2000)
);
create index machines_manufacturer_idx on public.machines(manufacturer_id);
create table public.analyses (
  owner_id uuid not null references public.account_roles(user_id) on delete cascade,
  id text not null check (length(id) between 1 and 120),
  data jsonb not null check (jsonb_typeof(data)='object' and octet_length(data::text)<=2000000 and data->>'id'=id),
  updated_at timestamptz not null default now(),
  primary key(owner_id,id)
);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create trigger manufacturer_updated before update on public.manufacturer_profiles for each row execute function public.touch_updated_at();
create trigger analysis_updated before update on public.analyses for each row execute function public.touch_updated_at();

alter table public.manufacturer_profiles enable row level security;
alter table public.machines enable row level security;
alter table public.analyses enable row level security;
revoke all on public.manufacturer_profiles, public.machines, public.analyses from anon, authenticated;
grant select, insert, delete on public.manufacturer_profiles, public.machines, public.analyses to authenticated;
grant update(business_name,contact_email,contact_phone,location,description,processes,materials,max_x_mm,max_y_mm,max_z_mm,tolerance_mm,capacity_notes,limitations,published) on public.manufacturer_profiles to authenticated;
grant update(name,brand,model,category,processes,materials,max_x_mm,max_y_mm,max_z_mm,tolerance_mm,special_capabilities,notes) on public.machines to authenticated;
grant update(data) on public.analyses to authenticated;
create policy "Read declared business capabilities" on public.manufacturer_profiles for select to authenticated
  using ((select public.verified_account_role()) is not null and (published or user_id=(select auth.uid())));
create policy "Create own manufacturer profile" on public.manufacturer_profiles for insert to authenticated
  with check (user_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer');
create policy "Edit own manufacturer profile" on public.manufacturer_profiles for update to authenticated
  using (user_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer')
  with check (user_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer');
create policy "Delete own manufacturer profile" on public.manufacturer_profiles for delete to authenticated
  using (user_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer');
create policy "Read visible machines" on public.machines for select to authenticated
  using ((select public.verified_account_role()) is not null and exists(select 1 from public.manufacturer_profiles p where p.user_id=manufacturer_id));
create policy "Create own machine" on public.machines for insert to authenticated
  with check (manufacturer_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer');
create policy "Edit own machine" on public.machines for update to authenticated
  using (manufacturer_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer')
  with check (manufacturer_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer');
create policy "Delete own machine" on public.machines for delete to authenticated
  using (manufacturer_id=(select auth.uid()) and (select public.verified_account_role())='manufacturer');
create policy "Read own analyses" on public.analyses for select to authenticated using (owner_id=(select auth.uid()) and (select public.verified_account_role())='designer');
create policy "Create own analyses" on public.analyses for insert to authenticated with check (owner_id=(select auth.uid()) and (select public.verified_account_role())='designer');
create policy "Edit own analyses" on public.analyses for update to authenticated using (owner_id=(select auth.uid()) and (select public.verified_account_role())='designer') with check (owner_id=(select auth.uid()) and (select public.verified_account_role())='designer');
create policy "Delete own analyses" on public.analyses for delete to authenticated using (owner_id=(select auth.uid()) and (select public.verified_account_role())='designer');
-- Existing ideas remain private and now require a verified account at the database boundary too.
create policy "Verified accounts only" on public.ideas as restrictive for all to authenticated
  using ((select public.verified_account_role()) is not null) with check ((select public.verified_account_role()) is not null);
