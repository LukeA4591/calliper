-- SQL CHECK expressions accept NULL; explicitly require a string ID in JSON payloads.
alter table public.analyses add constraint analysis_payload_has_id
  check (data ? 'id' and jsonb_typeof(data->'id') = 'string');
