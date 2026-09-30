// One-time bootstrap: creates the first admin login.
// Usage: node --env-file=.env.local scripts/create-admin.mjs <username> <password> "<full name>"
import { createClient } from '@supabase/supabase-js';

const [username, password, fullName] = process.argv.slice(2);
if (!username || !password || !fullName) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <username> <password> "<full name>"');
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('username: 3–32 chars, a-z 0-9 . _ -');
  process.exit(1);
}
if (password.length < 8) {
  console.error('password: at least 8 characters');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || 'staff.finote-tsidk.app';
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.createUser({
  email: `${username}@${domain}`,
  password,
  email_confirm: true,
  user_metadata: { username, full_name: fullName },
});
if (error) { console.error(error.message); process.exit(1); }

const { error: pErr } = await admin.from('staff_profiles').insert({
  user_id: data.user.id, username, full_name: fullName, is_admin: true,
});
if (pErr) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error(pErr.message);
  process.exit(1);
}
console.log(`Admin "${username}" created. Sign in at /login.`);
