import type { CrmGateway } from "./CrmGateway";
import { LocalCrmGateway } from "./LocalCrmGateway";
import { RestCrmGateway } from "./RestCrmGateway";
import { SupabaseCrmGateway } from "./SupabaseCrmGateway";

export function createGateway(): CrmGateway {
  const provider = import.meta.env.VITE_DATA_PROVIDER || "local";

  if (provider === "supabase") {
    return new SupabaseCrmGateway();
  }

  if (provider === "rest") {
    return new RestCrmGateway(import.meta.env.VITE_API_URL || "/api");
  }

  return new LocalCrmGateway();
}
