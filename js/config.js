// ─────────────────────────────────────────────────────────
// SUBSTITUA com os valores do seu projeto Supabase
// ─────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://skahqxanrdfdwxfejqcj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gpz6aFCeJ8fx_xdLRzmvkw_lXwgn2Uw";

const SUPABASE_OK = !SUPABASE_URL.includes("SEU_PROJETO")
                 && !SUPABASE_ANON_KEY.includes("SUA_ANON_KEY");
const sb = SUPABASE_OK ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;