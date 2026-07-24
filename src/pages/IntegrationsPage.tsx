import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  MessageCircle,
  PlugZap,
  RefreshCcw,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { ModalShell } from "../components/Common";
import type { IntegrationConnection, IntegrationProvider } from "../core/types";
import { eligibleLeadOwners } from "../core/crmConsistency";
import { formatDateTime } from "../core/utils";

const iconMap: Record<IntegrationProvider, typeof Webhook> = {
  meta: Webhook,
  google: Search,
  whatsapp: MessageCircle,
  webhook: PlugZap,
  website: ExternalLink,
};
const statusLabel = { connected: "Conectado", attention: "Requer atenção", disconnected: "Desconectado" };

function IntegrationModal({ integration, onClose }: { integration: IntegrationConnection; onClose: () => void }) {
  const { data, updateIntegration, testIntegration } = useCrm();
  const [draft, setDraft] = useState(integration);
  const stages = (data?.stages || []).filter((stage) => stage.pipelineId === draft.targetPipelineId);
  const users = eligibleLeadOwners(data?.users || [], draft.targetPipelineId);
  const apiBase = (import.meta.env.VITE_API_URL || location.origin).replace(/\/$/, "");
  const endpointUrl = `${apiBase}${draft.endpoint}`;
  const change = <K extends keyof IntegrationConnection>(key: K, value: IntegrationConnection[K]) => setDraft((old) => ({ ...old, [key]: value }));

  return (
    <ModalShell
      title={`Configurar ${integration.name}`}
      subtitle="Defina roteamento e mapeamento sem expor credenciais no navegador."
      onClose={onClose}
      wide
    >
      <div className="integration-config-layout">
        <aside className="integration-config-summary">
          <span className={`integration-status-pill status-${draft.status}`}><i />{statusLabel[draft.status]}</span>
          <h3>Fluxo desta conexão</h3>
          <ol>
            <li><span>1</span><div><strong>Receber</strong><p>O provedor envia um evento para o endpoint protegido.</p></div></li>
            <li><span>2</span><div><strong>Mapear</strong><p>Campos externos são associados aos campos do CRM.</p></div></li>
            <li><span>3</span><div><strong>Direcionar</strong><p>O lead entra no funil, etapa e responsável configurados.</p></div></li>
            <li><span>4</span><div><strong>Validar</strong><p>O teste confirma o contrato antes da ativação.</p></div></li>
          </ol>
          <div className="endpoint-box">
            <small>Endpoint</small>
            <code>{endpointUrl}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(endpointUrl)} aria-label="Copiar endpoint"><Copy size={15} /></button>
          </div>
          <div className="secure-note"><ShieldCheck size={16} /><span>Tokens e segredos permanecem em ambiente seguro no servidor.</span></div>
        </aside>

        <form
          className="modal-form integration-routing-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await updateIntegration(draft);
            onClose();
          }}
        >
          <section className="form-section">
            <div className="form-section-head"><h3>Identificação</h3><p>Informações visíveis para a equipe administrativa.</p></div>
            <div className="form-grid">
              <label>Conta ou identificação<input value={draft.accountLabel} onChange={(event) => change("accountLabel", event.target.value)} /></label>
              <label>Estado técnico<div className={`integration-status-readonly status-${draft.status}`}><i />{statusLabel[draft.status]}</div></label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head"><h3>Roteamento comercial</h3><p>Somente usuários com acesso ao funil podem ser selecionados.</p></div>
            <div className="form-grid">
              <label>Funil<select value={draft.targetPipelineId} onChange={(event) => {
                const pipelineId = event.target.value;
                const firstStage = data?.stages.find((stage) => stage.pipelineId === pipelineId);
                change("targetPipelineId", pipelineId);
                if (firstStage) change("targetStageId", firstStage.id);
                change("defaultOwnerId", null);
              }}>{(data?.pipelines || []).filter((pipeline) => pipeline.active).map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label>
              <label>Etapa inicial<select value={draft.targetStageId} onChange={(event) => change("targetStageId", event.target.value)}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
              <label>Responsável padrão<select value={draft.defaultOwnerId || ""} onChange={(event) => change("defaultOwnerId", event.target.value || null)}><option value="">Distribuição dinâmica</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.roleLabel}</option>)}</select></label>
              <label>Credencial<div className="integration-credential-readonly"><ShieldCheck size={16} />Gerenciada no servidor</div></label>
            </div>
          </section>

          <section className="form-section full-field">
            <div className="form-section-head"><h3>Mapeamento de campos</h3><p>Associe cada campo recebido ao destino correto no CRM.</p></div>
            <div className="mapping-list">
              {draft.fieldMappings.map((mapping, index) => (
                <div key={`${mapping.source}-${index}`}>
                  <label><span>Campo recebido</span><input value={mapping.source} onChange={(event) => change("fieldMappings", draft.fieldMappings.map((item, itemIndex) => itemIndex === index ? { ...item, source: event.target.value } : item))} /></label>
                  <Route size={17} />
                  <label><span>Campo do CRM</span><input value={mapping.target} onChange={(event) => change("fieldMappings", draft.fieldMappings.map((item, itemIndex) => itemIndex === index ? { ...item, target: event.target.value } : item))} /></label>
                  <button type="button" onClick={() => change("fieldMappings", draft.fieldMappings.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover mapeamento"><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="add-mapping" onClick={() => change("fieldMappings", [...draft.fieldMappings, { source: "novo_campo", target: "custom_field" }])}>Adicionar campo</button>
            </div>
          </section>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={async () => { await updateIntegration(draft); await testIntegration(draft.id); }}><RefreshCcw size={16} /> Testar conexão</button>
            <button type="submit" className="primary-button"><Settings2 size={16} /> Salvar roteamento</button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}

export function IntegrationsPage() {
  const { data, can, testIntegration } = useCrm();
  const [selected, setSelected] = useState<IntegrationConnection | null>(null);
  const integrations = data?.integrations || [];
  const summary = useMemo(() => ({
    connected: integrations.filter((item) => item.status === "connected").length,
    attention: integrations.filter((item) => item.status === "attention").length,
    disconnected: integrations.filter((item) => item.status === "disconnected").length,
    events: integrations.reduce((sum, item) => sum + item.eventsReceived, 0),
  }), [integrations]);

  const foundations = [
    {
      id: "whatsapp-core",
      name: "WhatsApp Business",
      description: "Texto, arquivos, áudios, templates e status permanecem no contrato atual.",
      status: "Núcleo operacional",
      detail: "A evolução multiempresa será feita pelo roteamento do número conectado para a organização correta, sem alterar o payload imutável do Make.",
      icon: MessageCircle,
      tone: "connected",
    },
    {
      id: "meta-leads",
      name: "Meta Lead Ads",
      description: "Formulários direcionados para funil, etapa e responsável configuráveis.",
      status: "Próxima conexão",
      detail: "O mapeamento deve ser administrado por organização e validar duplicidade pelo identificador externo do lead.",
      icon: Webhook,
      tone: "attention",
    },
    {
      id: "google-conversions",
      name: "Google Ads e Analytics",
      description: "Campanhas, GCLID e devolução de conversões qualificadas.",
      status: "Planejado",
      detail: "A conexão será ativada quando o armazenamento seguro e os logs de entrega estiverem disponíveis por organização.",
      icon: Search,
      tone: "disconnected",
    },
  ] as const;

  return (
    <div className="integrations-page">
      <section className="integration-summary-grid">
        <article><span className="integration-summary-icon blue"><PlugZap size={20} /></span><div><small>Conexões cadastradas</small><strong>{integrations.length}</strong><p>{summary.connected} operacionais</p></div></article>
        <article><span className="integration-summary-icon green"><Activity size={20} /></span><div><small>Eventos recebidos</small><strong>{summary.events}</strong><p>Volume acumulado informado pelos conectores</p></div></article>
        <article><span className="integration-summary-icon amber"><AlertTriangle size={20} /></span><div><small>Requerem atenção</small><strong>{summary.attention}</strong><p>{summary.disconnected} desconectadas</p></div></article>
      </section>

      <section className="panel integrations-intro">
        <div>
          <span className="section-kicker">Arquitetura de conexão</span>
          <h2>Integrações configuráveis, contratos estáveis</h2>
          <p>O CRM altera roteamento e mapeamento por empresa sem espalhar tokens, webhooks ou regras específicas pelo frontend.</p>
        </div>
        <div className="integration-flow">
          <span><b>1</b>Conectar</span><i />
          <span><b>2</b>Mapear</span><i />
          <span><b>3</b>Direcionar</span><i />
          <span><b>4</b>Testar</span>
        </div>
      </section>

      <div className="integration-cards">
        {integrations.length === 0 ? foundations.map((foundation) => {
          const Icon = foundation.icon;
          return (
            <article className={`integration-card integration-foundation status-${foundation.tone}`} key={foundation.id}>
              <header>
                <span className="integration-logo"><Icon size={22} /></span>
                <div><h3>{foundation.name}</h3><p>{foundation.description}</p></div>
                <span className={`integration-status-pill status-${foundation.tone}`}><i />{foundation.status}</span>
              </header>
              <div className="integration-card-content"><p>{foundation.detail}</p><div className="secure-note"><ShieldCheck size={16} />Credenciais e webhooks permanecem no servidor.</div></div>
            </article>
          );
        }) : integrations.map((integration) => {
          const Icon = iconMap[integration.provider];
          const pipeline = data?.pipelines.find((item) => item.id === integration.targetPipelineId);
          const stage = data?.stages.find((item) => item.id === integration.targetStageId);
          const owner = data?.users.find((item) => item.id === integration.defaultOwnerId);
          const error = integration.errors[0]?.replace(/modo demonstração/gi, "ambiente atual");
          return (
            <article className={`integration-card status-${integration.status}`} key={integration.id}>
              <header>
                <span className="integration-logo"><Icon size={22} /></span>
                <div><h3>{integration.name}</h3><p>{integration.description}</p></div>
                <span className={`integration-status-pill status-${integration.status}`}><i />{statusLabel[integration.status]}</span>
              </header>
              <div className="integration-card-content">
                <dl className="integration-details">
                  <div><dt>Conta</dt><dd>{integration.accountLabel || "Não configurada"}</dd></div>
                  <div><dt>Roteamento</dt><dd>{pipeline?.name || "Sem funil"}<small>{stage?.name || "Sem etapa"}</small></dd></div>
                  <div><dt>Responsável</dt><dd>{owner?.name || "Distribuição dinâmica"}</dd></div>
                  <div><dt>Último evento</dt><dd>{integration.lastEventAt ? formatDateTime(integration.lastEventAt) : "Nenhum evento"}<small>{integration.eventsReceived} recebidos</small></dd></div>
                </dl>
                <div className="integration-endpoint"><Webhook size={15} /><code>{integration.endpoint}</code></div>
                {error ? <div className="integration-message error"><XCircle size={16} /><span>{error}</span></div> : <div className="integration-message success"><CheckCircle2 size={16} /><span>Sem erros pendentes.</span></div>}
              </div>
              <footer>
                <button className="secondary-button" disabled={!can("integrations.manage")} onClick={() => testIntegration(integration.id)}><RefreshCcw size={16} /> Testar</button>
                <button className="primary-button" disabled={!can("integrations.manage")} onClick={() => setSelected(integration)}><Settings2 size={16} /> Configurar</button>
              </footer>
            </article>
          );
        })}
      </div>

      <details className="panel technical-webhook-doc">
        <summary><span><Webhook size={18} /><strong>Documentação do webhook genérico</strong><small>Referência técnica para landing pages e aplicações externas.</small></span><ExternalLink size={16} /></summary>
        <div><pre>{`POST /public/leads/webhook_7a91\nAuthorization: Bearer SUA_CHAVE\nContent-Type: application/json\n\n{\n  "nome": "João da Silva",\n  "telefone": "5555999999999",\n  "cidade": "Santa Rosa",\n  "valor_conta": 780,\n  "utm_source": "google",\n  "gclid": "abc123"\n}`}</pre></div>
      </details>

      {selected && <IntegrationModal integration={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
