import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const failures = [];
const requireText = (file, snippets) => {
  const content = read(file);
  for (const snippet of snippets) {
    if (!content.includes(snippet)) failures.push(`${file}: trecho obrigatório ausente: ${snippet}`);
  }
};
const forbidText = (file, snippets) => {
  const content = read(file);
  for (const snippet of snippets) {
    if (content.includes(snippet)) failures.push(`${file}: trecho proibido encontrado: ${snippet}`);
  }
};

if (!existsSync(join(root, "src/ui-system.css"))) failures.push("src/ui-system.css não encontrado");
if (existsSync(join(root, "src/ui-v5.css"))) failures.push("stylesheet legado src/ui-v5.css ainda existe");

requireText("src/main.tsx", ['import "./ui-system.css";']);
requireText("src/core/crmConsistency.ts", ["canUserOwnLead", "canUserHandleConversation", "eligibleConversationOwners"]);
requireText("src/pages/LeadsPage.tsx", ['special !== "invalid_owner"', 'role="button"', 'aria-label={`Abrir detalhes de ${lead.name}`}']);
requireText("src/pages/AnalyticsPage.tsx", ['special: "open_lead"', 'special: "won_lead"', "report-trend-chart", "health-grid"]);
requireText("src/pages/InboxPage.tsx", ["Responsável comercial", "Responsável pelo atendimento", "chat-file-input"]);
requireText("src/components/AppShell.tsx", ["mobile-drawer-controls", "setMobileSearchOpen(false)"]);
requireText("src/ui-system.css", ["V5.4 — Sistema visual final", ".team-card-alerts", ".admin-user-toolbar", ".chat-file-input"]);
forbidText("src/pages/IntegrationsPage.tsx", [">×</button>"]);

if (failures.length) {
  console.error("Falhas de contrato de UI/UX:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Contratos de UI/UX preservados.");
console.log("Tema único, coerência comercial, relatórios e pontos críticos verificados.");
