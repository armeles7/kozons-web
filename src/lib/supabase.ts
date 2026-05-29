// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Récupération des variables d'environnement locales
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Attention : Les variables Supabase ne sont pas encore configurées dans ton fichier .env.local");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
