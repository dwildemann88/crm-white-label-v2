import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigurationError = !supabaseUrl
  ? "VITE_SUPABASE_URL não foi configurada no arquivo .env.local."
  : !supabasePublishableKey
    ? "VITE_SUPABASE_PUBLISHABLE_KEY não foi configurada no arquivo .env.local."
    : null;
const isInviteSetup =
  new URLSearchParams(window.location.search).get("setup") === "invite";
// O fallback impede que a aplicação encerre durante a importação do módulo.
// Quando a configuração está ausente, main.tsx exibe uma tela orientativa e
// nenhuma operação é enviada para este cliente.
const clientUrl = supabaseUrl || "http://127.0.0.1:54321";
const clientKey = supabasePublishableKey || "supabase-not-configured";

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isInviteSetup,
  },
});
