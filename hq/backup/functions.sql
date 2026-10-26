-- Chill Pros HQ database functions (Supabase project rbhtdgqpktocavxbiafw, schema public).
-- Snapshot taken 2026-10-26 with pg_get_functiondef. Tables: hq_users, hq_sessions, hq_items, hq_messages,
-- hq_files, hq_assets, hq_asset_live, hq_asset_parts, hq_bridge_config, hq_users_pin_backup.

CREATE OR REPLACE FUNCTION public.hq_asset(p_name text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select body from hq_assets where p_name ~ '^(index(_v[0-9]{1,3})?|theme_[a-z0-9_]{1,40})$' and name = coalesce((select target from hq_asset_live where name = p_name), p_name) $function$;

CREATE OR REPLACE FUNCTION public.hq_can(p_user text, p_board text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  select case
    when p_user = 'brae' then true
    when p_user = 'eric' then p_board in ('eric','team')
    when p_user = 'mack' then p_board in ('mack','truck')
    when p_user in ('henry','nick','mob') then p_board in (p_user,'venture')
    else false end $function$;

CREATE OR REPLACE FUNCTION public.hq_can_msg(p_from text, p_to text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  select case
    when p_from not in ('brae','eric','mack','henry','nick','mob') then false
    when p_to = 'all' then p_from = 'brae'
    when p_to = 'venture' then p_from in ('brae','henry','nick','mob')
    when p_from = p_to then false
    else hq_sees(p_from, p_to) end $function$;

CREATE OR REPLACE FUNCTION public.hq_can_write(p_user text, p_board text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ select p_user = 'brae' $function$;

CREATE OR REPLACE FUNCTION public.hq_check(p_token text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select hq_me(p_token) $function$;

CREATE OR REPLACE FUNCTION public.hq_del(p_token text, p_id text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token); cur hq_items;
begin
  if me is null then return json_build_object('error','auth'); end if;
  select * into cur from hq_items where id = p_id;
  if cur.id is null then return json_build_object('ok', true); end if;
  if not (hq_full(me, cur.board) and (me = 'brae' or cur.kind <> 'owed')) then
    if cur.kind = 'step' or not hq_member_ok(me, cur.board, cur.kind, coalesce(cur.data->>'by', cur.updated_by), false) then
      return json_build_object('error','forbidden'); end if;
  end if;
  update hq_items set deleted = true, updated_at = now(), updated_by = me where id = p_id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_file_get(p_token text, p_id text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token); f hq_files;
begin
  if me is null then return json_build_object('error','auth'); end if;
  select * into f from hq_files where id = p_id;
  if f.id is null then return json_build_object('error','missing'); end if;
  if not hq_can(me, f.board) then return json_build_object('error','forbidden'); end if;
  return json_build_object('name', f.name, 'mime', f.mime, 'b64', encode(f.data, 'base64'));
end $function$;

CREATE OR REPLACE FUNCTION public.hq_file_put(p_token text, p_id text, p_board text, p_name text, p_mime text, p_b64 text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token); bin bytea;
begin
  if me is null then return json_build_object('error','auth'); end if;
  if not hq_member_ok(me, p_board, 'file', me, true) then return json_build_object('error','forbidden'); end if;
  bin := decode(p_b64, 'base64');
  if length(bin) > 8*1024*1024 then return json_build_object('error','too_big'); end if;
  insert into hq_files(id, board, name, mime, size, data, by) values (p_id, p_board, left(p_name,200), p_mime, length(bin), bin, me)
  on conflict (id) do nothing;
  return json_build_object('ok', true, 'size', length(bin));
end $function$;

CREATE OR REPLACE FUNCTION public.hq_full(p_user text, p_board text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  select p_user = 'brae'
      or (p_user = 'mack' and p_board = 'truck')
      or (p_user in ('henry','nick','mob') and p_board in (p_user,'venture')) $function$;

CREATE OR REPLACE FUNCTION public.hq_login(p_name text, p_pin text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare u hq_users; t text; k text := lower(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'));
begin
  select * into u from hq_users where name = k or lower(display) = k or lower(config->>'short') = k order by (name = k) desc, sort limit 1;
  if u.name is null then return json_build_object('error','bad_login'); end if;
  if u.locked_until is not null and u.locked_until > now() then
    return json_build_object('error','locked','until',u.locked_until); end if;
  if u.pin_hash <> crypt(p_pin, u.pin_hash) then
    update hq_users set
      locked_until = case when failed + 1 >= 5 then now() + interval '15 minutes' else null end,
      failed = case when failed + 1 >= 5 then 0 else failed + 1 end
    where name = u.name;
    return json_build_object('error','bad_login');
  end if;
  update hq_users set failed = 0, locked_until = null where name = u.name;
  t := encode(gen_random_bytes(24), 'hex');
  insert into hq_sessions(token, name) values (t, u.name);
  return json_build_object('token', t, 'name', u.name, 'display', u.display);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_logout(p_token text)
 RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  delete from hq_sessions where token = p_token returning json_build_object('ok', true)
$function$;

CREATE OR REPLACE FUNCTION public.hq_me(p_token text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select name from hq_sessions where token = p_token and created_at > now() - interval '30 days' $function$;

CREATE OR REPLACE FUNCTION public.hq_member_ok(p_user text, p_board text, p_kind text, p_owner text, p_new boolean)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  select case
    when p_user = 'brae' then true
    when not hq_can(p_user, p_board) then false
    when hq_full(p_user, p_board) then p_kind <> 'owed'
    when p_kind = 'step' then not p_new
    when p_kind = 'idea' then p_board = p_user
    when p_kind in ('note','income') then p_new or p_owner = p_user
    else false end
$function$;

CREATE OR REPLACE FUNCTION public.hq_people()
 RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select '[]'::json $function$;

CREATE OR REPLACE FUNCTION public.hq_pull(p_token text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token);
begin
  if me is null then return json_build_object('error','auth'); end if;
  return json_build_object(
    'me', me,
    'display', (select display from hq_users where name = me),
    'config', (select config from hq_users where name = me),
    'people', coalesce((select json_agg(json_build_object('name',name,'display',display,'config',config) order by sort) from hq_users
                 where name <> me and hq_sees(me, name)), '[]'::json),
    'items', coalesce((select json_agg(json_build_object('id',id,'board',board,'kind',kind,'data',data,'updated_at',updated_at,'updated_by',updated_by))
               from hq_items where not deleted and hq_can(me, board)), '[]'::json),
    'messages', coalesce((select json_agg(m order by m.created_at) from
               (select id, from_user, to_user, body, created_at, read_at from hq_messages
                 where (from_user = me or to_user = me or to_user = 'all' or (to_user = 'venture' and me in ('brae','henry','nick','mob')))
                   and (from_user = me or hq_sees(me, from_user))
                 order by created_at desc limit 600) m), '[]'::json),
    'shared', (select coalesce(json_object_agg(u.name, (select coalesce(json_agg(b), '[]'::json) from unnest(array['team','truck','venture']) b where hq_can(u.name, b) and hq_can(me, b))), '{}'::json)
               from hq_users u where u.name = me or hq_sees(me, u.name)),
    'full', (select coalesce(json_agg(b), '[]'::json) from unnest(array['brae','eric','mack','henry','nick','mob','team','truck','venture']) b where hq_full(me, b)),
    'with', case when me = 'brae' then (select json_build_object(
        'team',   (select 'with ' || coalesce(string_agg(display, ' & ' order by sort), '') from hq_users where name <> 'brae' and hq_can(name,'team')),
        'truck',  (select 'with ' || coalesce(string_agg(display, ' & ' order by sort), '') from hq_users where name <> 'brae' and hq_can(name,'truck')),
        'venture',(select 'with ' || coalesce(string_agg(display, ' & ' order by sort), '') from hq_users where name <> 'brae' and hq_can(name,'venture')))) else '{}'::json end,
    'now', now());
end $function$;

CREATE OR REPLACE FUNCTION public.hq_put(p_token text, p_id text, p_board text, p_kind text, p_data jsonb)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token); cur hq_items; owner text; d jsonb := p_data; isnew boolean; full_rights boolean;
begin
  if me is null then return json_build_object('error','auth'); end if;
  select * into cur from hq_items where id = p_id;
  isnew := cur.id is null or cur.deleted;
  owner := coalesce(cur.data->>'by', cur.updated_by);
  full_rights := hq_full(me, p_board) and (isnew or hq_full(me, cur.board));
  if not isnew and not full_rights then
    if p_board <> cur.board or p_kind <> cur.kind then return json_build_object('error','forbidden'); end if;
  end if;
  if not hq_member_ok(me, p_board, p_kind, owner, isnew) then return json_build_object('error','forbidden'); end if;
  if not full_rights and p_kind = 'step' then
    d := cur.data || jsonb_build_object('done', coalesce((p_data->>'done')::boolean,false), 'doneAt', p_data->'doneAt');
  end if;
  if isnew then d := d || jsonb_build_object('by', me);
  elsif cur.data ? 'by' then d := d || jsonb_build_object('by', cur.data->>'by'); end if;
  if length(d::text) > 20000 then return json_build_object('error','too_big'); end if;
  insert into hq_items(id, board, kind, data, updated_at, updated_by, deleted)
  values (p_id, p_board, p_kind, d, now(), me, false)
  on conflict (id) do update set board = excluded.board, kind = excluded.kind, data = excluded.data,
    updated_at = now(), updated_by = me, deleted = false;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_read(p_token text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token);
begin
  if me is null then return json_build_object('error','auth'); end if;
  update hq_messages set read_at = now() where to_user = me and read_at is null;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_read_from(p_token text, p_from text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token);
begin
  if me is null then return json_build_object('error','auth'); end if;
  update hq_messages set read_at = now() where to_user = me and read_at is null and from_user = p_from;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_sees(p_me text, p_other text)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  select case
    when p_me = 'brae' then p_other in ('brae','eric','mack','henry','nick','mob')
    when p_me in ('henry','nick','mob') then p_other in ('brae','henry','nick','mob')
    when p_me in ('eric','mack') then p_other = 'brae'
    else false end $function$;

CREATE OR REPLACE FUNCTION public.hq_send(p_token text, p_body text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token);
begin
  if me is null then return json_build_object('error','auth'); end if;
  if length(trim(coalesce(p_body,''))) = 0 then return json_build_object('error','empty'); end if;
  insert into hq_messages(from_user, to_user, body)
  values (me, case when me = 'brae' then 'eric' else 'brae' end, left(trim(p_body), 4000));
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_send_to(p_token text, p_to text, p_body text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare me text := hq_me(p_token); dest text := p_to;
begin
  if me is null then return json_build_object('error','auth'); end if;
  if length(trim(coalesce(p_body,''))) = 0 then return json_build_object('error','empty'); end if;
  if dest is null or not hq_can_msg(me, dest) or (dest not in ('venture','all') and not exists (select 1 from hq_users where name = dest)) then
    return json_build_object('error','bad_to'); end if;
  insert into hq_messages(from_user, to_user, body) values (me, dest, left(trim(p_body), 4000));
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.hq_theme(p_name text)
 RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with k as (select lower(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g')) as k),
  u as (select coalesce(config->>'theme','gibam') as t from hq_users, k where name = k.k or lower(display) = k.k or lower(config->>'short') = k.k order by (name = k.k) desc, sort limit 1),
  th as (select coalesce((select t from u),'gibam') as th)
  select json_build_object('theme', (select th from th),
    'v', coalesce((select extract(epoch from max(updated_at))::bigint::text from hq_assets where left(name, length('theme_'||(select th from th))) = 'theme_'||(select th from th)), '0')) $function$;

CREATE OR REPLACE FUNCTION public.hq_whoami(p_token text)
 RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$ select hq_me(p_token) $function$;
