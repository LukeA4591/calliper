-- Extend existing machine types without changing ownership, grants or RLS.
alter table public.manufacturer_profiles drop constraint manufacturer_profiles_processes_check;
alter table public.machines drop constraint machines_category_check;
alter table public.machines drop constraint machines_processes_check;
alter table public.manufacturer_profiles add constraint manufacturer_profiles_processes_check check (
  processes <@ array['cnc_milling_3_axis','cnc_milling_4_axis','cnc_milling_5_axis','cnc_turning','cnc_turn_mill','cnc_routing','manual_milling','manual_turning','laser_cutting','waterjet_cutting','plasma_cutting','wire_edm','surface_grinding','press_brake','additive_manufacturing']::text[]);
alter table public.machines add constraint machines_category_check check (
  category = any(array['cnc_milling_3_axis','cnc_milling_4_axis','cnc_milling_5_axis','cnc_turning','cnc_turn_mill','cnc_routing','manual_milling','manual_turning','laser_cutting','waterjet_cutting','plasma_cutting','wire_edm','surface_grinding','press_brake','additive_manufacturing']::text[]));
alter table public.machines add constraint machines_processes_check check (
  cardinality(processes) between 1 and 15 and processes <@ array['cnc_milling_3_axis','cnc_milling_4_axis','cnc_milling_5_axis','cnc_turning','cnc_turn_mill','cnc_routing','manual_milling','manual_turning','laser_cutting','waterjet_cutting','plasma_cutting','wire_edm','surface_grinding','press_brake','additive_manufacturing']::text[]);

-- Invoker security keeps table RLS active. All writes succeed or roll back together.
create function public.save_manufacturer_profile(business jsonb, equipment jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  row_data jsonb;
  saved_id uuid;
  machine_ids uuid[] := '{}';
  p public.manufacturer_profiles;
begin
  if public.verified_account_role() is distinct from 'manufacturer' then
    raise exception 'A verified manufacturer account is required';
  end if;
  if jsonb_typeof(equipment) is distinct from 'array' then raise exception 'Expected a machine list'; end if;
  if jsonb_array_length(equipment) > 50 then raise exception 'Too many machines'; end if;
  p := jsonb_populate_record(null::public.manufacturer_profiles, business);
  insert into public.manufacturer_profiles(user_id,business_name,contact_email,contact_phone,location,description,materials,tolerance_mm,capacity_notes,limitations)
  values(owner_id,p.business_name,p.contact_email,coalesce(p.contact_phone,''),p.location,coalesce(p.description,''),coalesce(p.materials,'{}'),p.tolerance_mm,coalesce(p.capacity_notes,''),coalesce(p.limitations,''))
  on conflict(user_id) do update set business_name=excluded.business_name,contact_email=excluded.contact_email,
    contact_phone=excluded.contact_phone,location=excluded.location,description=excluded.description,
    materials=excluded.materials,tolerance_mm=excluded.tolerance_mm,capacity_notes=excluded.capacity_notes,limitations=excluded.limitations;
  -- The profile row lock serializes complete saves for this owner.
  for row_data in select value from jsonb_array_elements(equipment) loop
    saved_id := (row_data->>'id')::uuid;
    if saved_id is null or saved_id = any(machine_ids) then raise exception 'Invalid or duplicate machine ID'; end if;
    machine_ids := array_append(machine_ids,saved_id);
    insert into public.machines(id,manufacturer_id,name,category,processes,max_x_mm,max_y_mm,max_z_mm)
    values(saved_id,owner_id,row_data->>'name',row_data->>'category',array[row_data->>'category'],
      (row_data->>'max_x_mm')::numeric,(row_data->>'max_y_mm')::numeric,(row_data->>'max_z_mm')::numeric)
    on conflict(id) do update set name=excluded.name,category=excluded.category,processes=excluded.processes,
      max_x_mm=excluded.max_x_mm,max_y_mm=excluded.max_y_mm,max_z_mm=excluded.max_z_mm
    where public.machines.manufacturer_id=owner_id
    returning id into saved_id;
    if saved_id is null then raise exception 'Machine belongs to another account'; end if;
  end loop;
  delete from public.machines where manufacturer_id=owner_id and not (id=any(machine_ids));
  update public.manufacturer_profiles set
    processes=array(select distinct m.category from public.machines m where m.manufacturer_id=owner_id),
    max_x_mm=null,max_y_mm=null,max_z_mm=null
  where user_id=owner_id;
end;
$$;
revoke all on function public.save_manufacturer_profile(jsonb,jsonb) from public,anon;
grant execute on function public.save_manufacturer_profile(jsonb,jsonb) to authenticated;
