-- The church is in ወረዳ 13 (not ወረዳ 1). Only replaces the old default text.
update public.site_settings set contact_address = 'ወረዳ 13 • አቃቂ ቃሊቲ • አዲስ አበባ', updated_at = now()
where id and contact_address = '1 • አቃቂ ቃሊቲ • አዲስ አበባ';
