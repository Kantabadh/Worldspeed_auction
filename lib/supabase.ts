import { createClient } from "@supabase/supabase-js";

// Read Supabase project URL from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Read Supabase anon public key from .env.local
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);