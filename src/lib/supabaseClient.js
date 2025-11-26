import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargamos las variables AQUÍ mismo para asegurar que existan
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR FATAL: Faltan las variables de entorno de Supabase en .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);