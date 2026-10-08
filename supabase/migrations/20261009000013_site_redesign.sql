-- Round 4: public site redesign (look of eotcssu.et).
-- The long home page reads its texts and contacts from site_settings so that
-- የውስጥ ግንኙነት can edit them. Defaults are the school's entry on eotcssu.et.

alter table public.site_settings
  add column hero_path        text,
  add column hero_text        text,
  add column about_title      text,
  add column about_text       text,
  add column mission          text,
  add column vision           text,
  add column core_values      text,          -- one value per line
  add column contact_phone    text,
  add column contact_email    text,
  add column contact_address  text,
  add column map_lat          numeric(9, 6) check (map_lat between -90 and 90),
  add column map_lng          numeric(9, 6) check (map_lng between -180 and 180);

update public.site_settings set
  hero_text = 'ሰንበት ትምህርት ቤቷ ለአካባቢው ምእመናን፣ወጣቶች፣ጎልማሶች፣ለህፃናት በተከታታይ እና በርእቀት መንፈሳዊ ተከታታይ ትምህርቶችን፣ የአብነት ትምህርት፣ያሬዳዊ ዝማሬ ስልቶችን እና የቤተክርስቲያኗ የዜማ መዛሪያ ከሆኑት የበገና ትምህርቶችን ገፅለገፅ እና እንዲሁም ዘመኑን በዋጀ መልኩ በማህበራዊ ሚዲያ እያስተማረች የድርሻዋን እየተወጣች ትገኛለች።',
  about_title = 'ለሁሉም እድሜ ደረጃ እምነት፣ ትምህርት እና አስተባበር ማሳደግ',
  about_text = 'በ28/11/2000ዓ.ም መቋኞ ቤተ-ክርስቲያና ተሰርታ ከተጠናቀቀ በኃላ በ29/11/2000 ዓ.ም የመልአኩ የቅዱስ ሩፋኤል ፅላት ገብቶ ስርዓተ ቅዳሴ ተፈፅሞ ካበቃ በኃላ 50 በማይሞሉ አባላት በወቅቱ በድቁና በሚያገለግለው በዲያቆን ካሳሁን ጌታቸው አማካኝነት ሰንበት ትምህርት ቤቷን በመመስረትና ጊዜያዊ ሰብሳቢም በመሆን አገልግሎና አቋቁሞ ካበቃ በኃላ ለተተኪዎች አስረክባል፡፡',
  mission = '‹‹ሒዱና አሕዛብን ሁሉ በአብ በወልድና በመንፈስ ቅዱስ ስም እያጠመቃችሁ ያዘዝኋችሁንም ሁሉ እንዲጠብቁ እያስተማራችሁ ደቀ መዛሙርት አድርጓቸው››፡፡ማቴ ፳፰፥፲፱ ባለው አምላካዊ ቃል መሠረት ወንጌልን አመቺ በሆነ መንገድ ሁሉ ለመላው ዓለም መስበክ፡፡',
  vision = E'1. የኢትዮጲያ ኦርቶዶክስ ተዋህዶ እምነት እና ስነ- ስርዓት ተጠብቆ ሣይለወጥ ሳይበረዝ በቀጥታ ከትውልድ ወደ ትውልድ እንዲተላለፍ ማድረግ፡፡\n2. ህፃናትና ወጣቶች በእምነት እና በክርስቲያናዊ ስነ ምግባር እንዲያድጉ ማድረግ፡፡',
  core_values = E'ፍቅር\nትህትና\nታዛዥነት\nበጎነት\nትዕግስት',
  contact_phone = '+251981954946',
  contact_email = 'finotetsidiki13@gmail.com',
  contact_address = '1 • አቃቂ ቃሊቲ • አዲስ አበባ',
  map_lat = 8.87890,
  map_lng = 38.80538,
  sections = '[{"key":"events","visible":true},{"key":"photos","visible":true},{"key":"mission","visible":true},{"key":"about","visible":true},{"key":"departments","visible":true},{"key":"welcome","visible":true},{"key":"donate","visible":true},{"key":"contact","visible":true},{"key":"social","visible":true}]',
  updated_at = now()
where id;

alter table public.site_settings alter column sections set default
  '[{"key":"events","visible":true},{"key":"photos","visible":true},{"key":"mission","visible":true},{"key":"about","visible":true},{"key":"departments","visible":true},{"key":"welcome","visible":true},{"key":"donate","visible":true},{"key":"contact","visible":true},{"key":"social","visible":true}]';

-- Official social accounts (as listed on eotcssu.et); only added when that platform has none yet.
insert into public.social_links (platform, url, sort)
select v.platform, v.url, v.sort
from (values
  ('telegram',  'https://t.me/finote_Tsidiki_0613', 1),
  ('facebook',  'https://www.facebook.com/profile.php?id=100082976035006', 2),
  ('instagram', 'https://www.instagram.com/finotetsidiksenbettmehirt', 3),
  ('youtube',   'https://www.youtube.com/@finotetsedik', 4)
) as v(platform, url, sort)
where not exists (select 1 from public.social_links s where s.platform = v.platform);
