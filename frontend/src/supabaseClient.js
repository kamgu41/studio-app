import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    'Заполните VITE_SUPABASE_URL и ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY в frontend/.env.local'
  );
}

if (key.startsWith('sb_secret_')) {
  throw new Error(
    'Во фронтенде нельзя использовать секретный ключ Supabase'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
