-- Rosella Coffee custom-priced items for the parts list (chillbros_parts_catalog).
-- The catalog is global (no per-customer pricing), so every item is prefixed
-- "Rosella - " with part numbers RSL-*. track_inventory = false and stock = 0
-- so they can be added to an invoice without stock blocking them.
-- default_cost is 0 (real cost unknown). Prices are the historical Rosella
-- billing rates from the old Jobber account. Idempotent via part_number.
-- Run in the LIVE Supabase project (xespxlqcjvhompsxranc) — docs/database-source-of-truth.md.

insert into public.chillbros_parts_catalog (name, part_number, default_cost, retail_price, stock, track_inventory)
values
  ('Rosella - Trip / return trip charge',               'RSL-TRIP',        0,  30, 0, false),
  ('Rosella - Service charge / first hour',             'RSL-SVC-1HR',     0, 140, 0, false),
  ('Rosella - Additional / return / offsite labor (hr)','RSL-LABOR-HR',    0,  80, 0, false),
  ('Rosella - Drain clearing with nitrogen',            'RSL-DRAIN-N2',    0,  90, 0, false),
  ('Rosella - Cooler preventative maintenance (unit)',  'RSL-PM-COOLER',   0,  45, 0, false),
  ('Rosella - Convection oven preventative maintenance (unit)','RSL-PM-OVEN',0,185, 0, false),
  ('Rosella - Magnetron (invoice #282 / quote #201)',   'RSL-MAGNETRON-360',0,360, 0, false),
  ('Rosella - Magnetron (invoice #280 price)',          'RSL-MAGNETRON-385',0,385, 0, false),
  ('Rosella - Relay',                                   'RSL-RELAY',       0, 240, 0, false),
  ('Rosella - Fuse',                                    'RSL-FUSE',        0,  37, 0, false),
  ('Rosella - Waveguide gasket',                        'RSL-WG-GASKET',   0,  34, 0, false),
  ('Rosella - Waveguide window',                        'RSL-WG-WINDOW',   0,  64, 0, false),
  ('Rosella - Door switch',                             'RSL-DOOR-SWITCH', 0,  20, 0, false),
  ('Rosella - Appliance delivery / removal',            'RSL-DELIVERY',    0, 150, 0, false),
  ('Rosella - Right hinge arm',                         'RSL-HINGE-ARM-R', 0,  65, 0, false),
  ('Rosella - Hinge bracket',                           'RSL-HINGE-BRKT',  0,  80, 0, false),
  ('Rosella - Hardware hook',                           'RSL-HOOK',        0,  15, 0, false)
on conflict (part_number) do nothing;
