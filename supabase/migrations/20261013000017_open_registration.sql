-- Open public self-registration now (HR can close it, or set an end date, in
-- HR › የሕዝብ ምዝገባ ማመልከቻዎች).
update public.site_settings set registration_open = true, registration_until = null, updated_at = now() where id;
