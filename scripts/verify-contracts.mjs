import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "src/infrastructure/SupabaseCrmGateway.ts",
  "supabase/functions/dispatch-whatsapp-message/index.ts",
  "supabase/functions/dispatch-whatsapp-template/index.ts",
  "supabase/functions/prepare-whatsapp-media-upload/index.ts",
  "supabase/functions/receive-whatsapp-message/index.ts",
  "supabase/functions/receive-whatsapp-status/index.ts",
  "supabase/functions/store-whatsapp-media/index.ts",
  "supabase/functions/admin-manage-crm-user/index.ts",
  "supabase/migrations/202607230001_provision_crm_organization.sql",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`Arquivo obrigatório ausente: ${file}`);
}

const gatewayPath = resolve(root, "src/infrastructure/SupabaseCrmGateway.ts");
const gateway = existsSync(gatewayPath) ? readFileSync(gatewayPath, "utf8") : "";
const requiredGatewayContracts = [
  "open_crm_whatsapp_conversation",
  "send_crm_message_local",
  "prepare-whatsapp-media-upload",
  "finalize_crm_whatsapp_media_upload",
  "fail_crm_whatsapp_media_upload",
  "dispatch-whatsapp-message",
  "dispatch-whatsapp-template",
  "mark_crm_conversation_read",
  "transfer_crm_conversation",
];

for (const contract of requiredGatewayContracts) {
  if (!gateway.includes(contract)) failures.push(`Contrato do gateway removido: ${contract}`);
}

const dispatchPath = resolve(root, "supabase/functions/dispatch-whatsapp-message/index.ts");
const dispatch = existsSync(dispatchPath) ? readFileSync(dispatchPath, "utf8") : "";
for (const token of ["MAKE_WHATSAPP_WEBHOOK_URL", "claim_crm_outbound_message", "complete_crm_outbound_message", "fail_crm_outbound_message"]) {
  if (!dispatch.includes(token)) failures.push(`Contrato de despacho removido: ${token}`);
}

for (const secretFile of [".env", ".env.local"]) {
  if (existsSync(resolve(root, secretFile))) failures.push(`Arquivo sensível presente no pacote: ${secretFile}`);
}

if (failures.length) {
  console.error("Falha na verificação de contratos:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Contratos essenciais preservados.");
console.log(`${requiredFiles.length} arquivos e ${requiredGatewayContracts.length} integrações verificadas.`);
