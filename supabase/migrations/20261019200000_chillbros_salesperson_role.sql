-- Adds a dedicated "salesperson" staff role: a commission-paid rep whose
-- whole job is working Revenue Radar leads start to finish (unlike "office",
-- which is scoped to leads assigned to them and also covers dispatch-ish
-- admin work). Already applied directly to the live database
-- (xespxlqcjvhompsxranc) on 2026-10-19; this file is the repo record.
ALTER TYPE public.chillbros_user_role ADD VALUE IF NOT EXISTS 'salesperson';
