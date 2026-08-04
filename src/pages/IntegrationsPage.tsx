import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  MessageCircle,
  Plus,
  PlugZap,
  Route,
  Settings2,
  ShieldCheck,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { ModalShell } from "../components/Common";
import { eligibleLeadOwners } from "../core/crmConsistency";
import type {
  IntegrationConnection,
  IntegrationDuplicateRule,
  IntegrationFieldMap,
  IntegrationSecretResult,
  NewWebhookIntegrationInput,
} from "../core/types";
import { formatDateTime } from "../core/utils";

const statusLabel = {
  connected: "Recebendo eventos",
  attention: "Aguardando primeiro evento",
  disconnected: "Desativado",
} as const;

const duplicateRuleOptions: Array<{
  value: IntegrationDuplicateRule;
  label: string;
  description: string;
}> = [
  {
    value: "external_or_contact",
    label: "ID externo; depois telefone ou e-mail",
    description:
      "Prioriza o identificador do sistema de origem e usa contato como alternativa.",
  },
  {
    value: "external_id",
    label: "Somente ID externo",
    description:
      "Exige um identificador externo estável para reconhecer reenvios.",
  },
  {
    value: "phone_or_email",
    label: "Telefone ou e-mail",
    description:
      "Compara os dados do contato dentro da mesma organização.",
  },
  {
    value: "always_create",
    label: "Sempre criar um novo lead",
    description:
      "Não bloqueia duplicidades. Use somente quando a origem já fizer esse controle.",
  },
];

const technicalTargets = [
  { key: "external_id", label: "ID externo do lead" },
  { key: "utm_source", label: "UTM source" },
  { key: "utm_medium", label: "UTM medium" },
  { key: "utm_content", label: "UTM content" },
  { key: "utm_term", label: "UTM term" },
  { key: "gclid", label: "GCLID" },
  { key: "fbclid", label: "FBCLID" },
] as const;

function webhookEndpoint(): string {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );

  return supabaseUrl
    ? `${supabaseUrl}/functions/v1/receive-crm-lead`
    : "/functions/v1/receive-crm-lead";
}

function initialWebhookDraft(
  data: ReturnType<typeof useCrm>["data"],
): NewWebhookIntegrationInput {
  const pipeline = data?.pipelines.find((item) => item.active);
  const stage = data?.stages
    .filter((item) => item.pipelineId === pipeline?.id)
    .sort((a, b) => a.order - b.order)[0];
  const source =
    data?.leadSources.find((item) => item.code === "website" && item.active) ??
    data?.leadSources.find((item) => item.code === "manual" && item.active) ??
    data?.leadSources.find((item) => item.active);

  const mappings: IntegrationFieldMap[] = [{ source: "name", target: "name" }];

  if (data?.leadFields.some((field) => field.key === "phone" && field.active)) {
    mappings.push({ source: "phone", target: "phone" });
  }

  if (data?.leadFields.some((field) => field.key === "email" && field.active)) {
    mappings.push({ source: "email", target: "email" });
  }

  return {
    name: "Webhook do site",
    description: "Recebimento de leads por formulário ou automação externa.",
    targetPipelineId: pipeline?.id ?? "",
    targetStageId: stage?.id ?? "",
    sourceId: source?.id ?? "",
    defaultOwnerId: null,
    duplicateRule: "external_or_contact",
    fieldMappings: mappings,
    active: true,
  };
}

function integrationToDraft(
  integration: IntegrationConnection,
): NewWebhookIntegrationInput {
  return {
    name: integration.name,
    description: integration.description,
    targetPipelineId: integration.targetPipelineId,
    targetStageId: integration.targetStageId,
    sourceId: integration.sourceId,
    defaultOwnerId: integration.defaultOwnerId,
    duplicateRule: integration.duplicateRule,
    fieldMappings: integration.fieldMappings.map((item) => ({ ...item })),
    active: integration.active,
  };
}

function SecretModal({
  credentials,
  onClose,
}: {
  credentials: IntegrationSecretResult;
  onClose: () => void;
}) {
  const endpoint = webhookEndpoint();
  const copy = (value: string) => navigator.clipboard?.writeText(value);

  return (
    <ModalShell
      title="Credencial do webhook"
      subtitle="Esta chave secreta será exibida somente agora. Guarde-a no Make, n8n ou servidor que enviará os leads."
      onClose={onClose}
      wide
    >
      <div className="webhook-secret-layout">
        <div className="integration-message warning">
          <AlertTriangle size={18} />
          <span>
            Não envie esta credencial por mensagens e não a salve no código do
            site. Após fechar esta janela, o CRM mostrará apenas os últimos
            quatro caracteres.
          </span>
        </div>

        <div className="credential-field">
          <div>
            <small>Endpoint</small>
            <code>{endpoint}</code>
          </div>
          <button type="button" onClick={() => copy(endpoint)}>
            <Copy size={16} /> Copiar
          </button>
        </div>

        <div className="credential-field">
          <div>
            <small>Cabeçalho x-crm-integration-key</small>
            <code>{credentials.publicKey}</code>
          </div>
          <button type="button" onClick={() => copy(credentials.publicKey)}>
            <Copy size={16} /> Copiar
          </button>
        </div>

        <div className="credential-field credential-secret">
          <div>
            <small>Authorization: Bearer</small>
            <code>{credentials.secret}</code>
          </div>
          <button type="button" onClick={() => copy(credentials.secret)}>
            <Copy size={16} /> Copiar
          </button>
        </div>

        <div className="modal-footer">
          <button type="button" className="primary-button" onClick={onClose}>
            <CheckCircle2 size={16} /> Já guardei a credencial
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function IntegrationModal({
  integration,
  onClose,
  onCredentials,
}: {
  integration: IntegrationConnection | null;
  onClose: () => void;
  onCredentials: (credentials: IntegrationSecretResult) => void;
}) {
  const {
    data,
    createWebhookIntegration,
    updateIntegration,
    rotateIntegrationSecret,
    deleteIntegration,
  } = useCrm();
  const [draft, setDraft] = useState<NewWebhookIntegrationInput>(() =>
    integration ? integrationToDraft(integration) : initialWebhookDraft(data),
  );
  const [saving, setSaving] = useState(false);

  const stages = (data?.stages || [])
    .filter((stage) => stage.pipelineId === draft.targetPipelineId)
    .sort((a, b) => a.order - b.order);
  const users = eligibleLeadOwners(data?.users || [], draft.targetPipelineId);
  const sources = (data?.leadSources || []).filter((source) => source.active);
  const targetFields = (data?.leadFields || [])
    .filter((field) => field.active)
    .sort((a, b) => a.position - b.position);
  const targetCustomFields = (data?.customFields || [])
    .filter(
      (field) =>
        field.active &&
        (field.pipelineId === null || field.pipelineId === draft.targetPipelineId),
    )
    .sort((a, b) => a.position - b.position);

  const change = <K extends keyof NewWebhookIntegrationInput>(
    key: K,
    value: NewWebhookIntegrationInput[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const normalizedMappings = draft.fieldMappings
    .map((item) => ({
      source: item.source.trim(),
      target: item.target.trim(),
    }))
    .filter((item) => item.source || item.target);

  const duplicateSources = new Set<string>();
  const duplicateTargets = new Set<string>();
  const seenSources = new Set<string>();
  const seenTargets = new Set<string>();

  for (const mapping of normalizedMappings) {
    const source = mapping.source.toLowerCase();
    const target = mapping.target.toLowerCase();
    if (seenSources.has(source)) duplicateSources.add(source);
    if (seenTargets.has(target)) duplicateTargets.add(target);
    seenSources.add(source);
    seenTargets.add(target);
  }

  const valid =
    draft.name.trim().length >= 2 &&
    Boolean(draft.targetPipelineId) &&
    Boolean(draft.targetStageId) &&
    Boolean(draft.sourceId) &&
    normalizedMappings.length > 0 &&
    normalizedMappings.every((item) => item.source && item.target) &&
    normalizedMappings.some((item) => item.target === "name") &&
    duplicateSources.size === 0 &&
    duplicateTargets.size === 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);

    try {
      const normalizedDraft = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
        fieldMappings: normalizedMappings,
      };

      if (!integration) {
        const credentials = await createWebhookIntegration(normalizedDraft);
        onClose();
        onCredentials(credentials);
        return;
      }

      const source = sources.find((item) => item.id === draft.sourceId);
      await updateIntegration({
        ...integration,
        ...normalizedDraft,
        accountLabel: source?.name ?? integration.accountLabel,
        status: draft.active
          ? integration.lastEventAt
            ? "connected"
            : "attention"
          : "disconnected",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const rotateSecret = async () => {
    if (!integration || saving) return;
    const confirmed = window.confirm(
      "Gerar uma nova chave secreta? A chave atual deixará de funcionar imediatamente quando o receptor for publicado.",
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const credentials = await rotateIntegrationSecret(integration.id);
      onClose();
      onCredentials(credentials);
    } finally {
      setSaving(false);
    }
  };

  const removeIntegration = async () => {
    if (!integration || saving) return;
    const confirmed = window.confirm(
      `Excluir “${integration.name}”? A configuração e o histórico técnico desse webhook serão removidos.`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteIntegration(integration.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={integration ? `Configurar ${integration.name}` : "Novo webhook"}
      subtitle="Defina o destino e associe os campos recebidos aos campos desta empresa."
      onClose={onClose}
      wide
    >
      <div className="integration-config-layout">
        <aside className="integration-config-summary">
          <span
            className={`integration-status-pill status-${
              draft.active ? "attention" : "disconnected"
            }`}
          >
            <i />
            {draft.active ? "Ativo" : "Desativado"}
          </span>

          <h3>Identificação técnica</h3>
          <div className="endpoint-box">
            <small>Endpoint</small>
            <code>{webhookEndpoint()}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(webhookEndpoint())}
              aria-label="Copiar endpoint"
            >
              <Copy size={15} />
            </button>
          </div>

          <div className="endpoint-box">
            <small>x-crm-integration-key</small>
            <code>{integration?.publicKey || "Gerado ao salvar"}</code>
            {integration && (
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(integration.publicKey)
                }
                aria-label="Copiar identificador"
              >
                <Copy size={15} />
              </button>
            )}
          </div>

          <div className="secure-note">
            <ShieldCheck size={16} />
            <span>
              O segredo é armazenado somente como hash e não pode ser recuperado
              pelo navegador.
            </span>
          </div>
        </aside>

        <form
          className="modal-form integration-routing-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <section className="form-section">
            <div className="form-section-head">
              <h3>Identificação</h3>
              <p>Nome interno e estado da entrada de leads.</p>
            </div>
            <div className="form-grid">
              <label>
                Nome da integração
                <input
                  value={draft.name}
                  maxLength={100}
                  onChange={(event) => change("name", event.target.value)}
                />
              </label>
              <label>
                Estado
                <select
                  value={draft.active ? "active" : "disabled"}
                  onChange={(event) =>
                    change("active", event.target.value === "active")
                  }
                >
                  <option value="active">Ativo</option>
                  <option value="disabled">Desativado</option>
                </select>
              </label>
              <label className="full-field">
                Descrição
                <input
                  value={draft.description}
                  maxLength={240}
                  onChange={(event) =>
                    change("description", event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h3>Roteamento comercial</h3>
              <p>O webhook só pode direcionar leads para esta organização.</p>
            </div>
            <div className="form-grid">
              <label>
                Funil
                <select
                  value={draft.targetPipelineId}
                  onChange={(event) => {
                    const pipelineId = event.target.value;
                    const firstStage = (data?.stages || [])
                      .filter((stage) => stage.pipelineId === pipelineId)
                      .sort((a, b) => a.order - b.order)[0];
                    setDraft((current) => ({
                      ...current,
                      targetPipelineId: pipelineId,
                      targetStageId: firstStage?.id ?? "",
                      defaultOwnerId: null,
                      fieldMappings: current.fieldMappings.filter(
                        (mapping) => {
                          const customField = data?.customFields.find(
                            (field) => field.key === mapping.target,
                          );
                          return (
                            !customField ||
                            customField.pipelineId === null ||
                            customField.pipelineId === pipelineId
                          );
                        },
                      ),
                    }));
                  }}
                >
                  {(data?.pipelines || [])
                    .filter((pipeline) => pipeline.active)
                    .map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Etapa inicial
                <select
                  value={draft.targetStageId}
                  onChange={(event) => change("targetStageId", event.target.value)}
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Origem registrada
                <select
                  value={draft.sourceId}
                  onChange={(event) => change("sourceId", event.target.value)}
                >
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Responsável padrão
                <select
                  value={draft.defaultOwnerId || ""}
                  onChange={(event) =>
                    change("defaultOwnerId", event.target.value || null)
                  }
                >
                  <option value="">Sem responsável padrão</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} — {user.roleLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full-field">
                Regra de duplicidade
                <select
                  value={draft.duplicateRule}
                  onChange={(event) =>
                    change(
                      "duplicateRule",
                      event.target.value as IntegrationDuplicateRule,
                    )
                  }
                >
                  {duplicateRuleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="field-help">
                  {
                    duplicateRuleOptions.find(
                      (option) => option.value === draft.duplicateRule,
                    )?.description
                  }
                </small>
              </label>
            </div>
          </section>

          <section className="form-section full-field">
            <div className="form-section-head">
              <h3>Mapeamento de campos</h3>
              <p>
                O nome do campo recebido deve corresponder exatamente à chave
                enviada no JSON. O campo Nome é obrigatório.
              </p>
            </div>

            <div className="mapping-list mapping-list-selects">
              {draft.fieldMappings.map((mapping, index) => {
                const sourceKey = mapping.source.trim().toLowerCase();
                const targetKey = mapping.target.trim().toLowerCase();
                return (
                  <div key={`${index}-${mapping.target}`}>
                    <label>
                      <span>Campo recebido</span>
                      <input
                        value={mapping.source}
                        className={
                          duplicateSources.has(sourceKey) ? "input-error" : ""
                        }
                        placeholder="ex.: full_name"
                        onChange={(event) =>
                          change(
                            "fieldMappings",
                            draft.fieldMappings.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, source: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <Route size={17} />
                    <label>
                      <span>Campo do CRM</span>
                      <select
                        value={mapping.target}
                        className={
                          duplicateTargets.has(targetKey) ? "input-error" : ""
                        }
                        onChange={(event) =>
                          change(
                            "fieldMappings",
                            draft.fieldMappings.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, target: event.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Selecione</option>
                        <optgroup label="Campos padrão">
                          {targetFields.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </optgroup>
                        {targetCustomFields.length > 0 && (
                          <optgroup label="Campos personalizados">
                            {targetCustomFields.map((field) => (
                              <option key={field.id} value={field.key}>
                                {field.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Rastreamento técnico">
                          {technicalTargets.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        change(
                          "fieldMappings",
                          draft.fieldMappings.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                      aria-label="Remover mapeamento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                className="add-mapping"
                onClick={() =>
                  change("fieldMappings", [
                    ...draft.fieldMappings,
                    { source: "", target: "" },
                  ])
                }
              >
                <Plus size={15} /> Adicionar campo
              </button>
            </div>

            {!draft.fieldMappings.some((item) => item.target === "name") && (
              <div className="integration-message error">
                <AlertTriangle size={16} />
                <span>Adicione um mapeamento para o campo Nome.</span>
              </div>
            )}
          </section>

          <div className="modal-footer integration-modal-actions">
            {integration && (
              <>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void removeIntegration()}
                  disabled={saving}
                >
                  <Trash2 size={16} /> Excluir
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void rotateSecret()}
                  disabled={saving}
                >
                  <KeyRound size={16} /> Gerar nova chave
                </button>
              </>
            )}
            <button
              type="submit"
              className="primary-button"
              disabled={!valid || saving}
            >
              <Settings2 size={16} />
              {saving
                ? "Salvando..."
                : integration
                  ? "Salvar configuração"
                  : "Criar webhook"}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}

export function IntegrationsPage() {
  const { data, can } = useCrm();
  const [selected, setSelected] = useState<IntegrationConnection | null>(null);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] =
    useState<IntegrationSecretResult | null>(null);

  const integrations = (data?.integrations || []).filter(
    (item) => item.provider === "webhook",
  );

  const summary = useMemo(
    () => ({
      active: integrations.filter((item) => item.active).length,
      attention: integrations.filter((item) => item.status === "attention").length,
      events: integrations.reduce(
        (sum, item) => sum + item.eventsReceived,
        0,
      ),
    }),
    [integrations],
  );

  const canManage = can("integrations.manage");

  return (
    <div className="integrations-page">
      <section className="integration-summary-grid">
        <article>
          <span className="integration-summary-icon blue">
            <PlugZap size={20} />
          </span>
          <div>
            <small>Webhooks cadastrados</small>
            <strong>{integrations.length}</strong>
            <p>{summary.active} ativos</p>
          </div>
        </article>
        <article>
          <span className="integration-summary-icon green">
            <Activity size={20} />
          </span>
          <div>
            <small>Eventos recebidos</small>
            <strong>{summary.events}</strong>
            <p>Contagem isolada por organização</p>
          </div>
        </article>
        <article>
          <span className="integration-summary-icon amber">
            <AlertTriangle size={20} />
          </span>
          <div>
            <small>Aguardando evento</small>
            <strong>{summary.attention}</strong>
            <p>O receptor será publicado na próxima etapa</p>
          </div>
        </article>
      </section>

      <section className="panel integrations-intro">
        <div>
          <span className="section-kicker">Entrada segura de leads</span>
          <h2>Webhooks configurados por empresa</h2>
          <p>
            Cada conexão possui identificador e chave próprios. O roteamento,
            a origem e o mapeamento ficam vinculados à organização atual.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={!canManage}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} /> Novo webhook
        </button>
      </section>

      <div className="integration-message warning webhook-stage-notice">
        <AlertTriangle size={17} />
        <span>
          A configuração e as credenciais já são reais. O endpoint ainda não
          recebe leads nesta etapa; a Edge Function será instalada e testada na
          Etapa 4A.2.
        </span>
      </div>

      <div className="integration-cards">
        <article className="integration-card integration-foundation status-connected">
          <header>
            <span className="integration-logo">
              <MessageCircle size={22} />
            </span>
            <div>
              <h3>WhatsApp Business</h3>
              <p>Operação de mensagens preservada no contrato atual.</p>
            </div>
            <span className="integration-status-pill status-connected">
              <i /> Núcleo ativo
            </span>
          </header>
          <div className="integration-card-content">
            <p>
              As funções de WhatsApp não são alteradas por este módulo. O novo
              webhook será usado somente para entrada genérica de leads.
            </p>
            <div className="secure-note">
              <ShieldCheck size={16} />
              <span>Sem mudanças nas Edge Functions atuais do WhatsApp.</span>
            </div>
          </div>
        </article>

        {integrations.map((integration) => {
          const pipeline = data?.pipelines.find(
            (item) => item.id === integration.targetPipelineId,
          );
          const stage = data?.stages.find(
            (item) => item.id === integration.targetStageId,
          );
          const source = data?.leadSources.find(
            (item) => item.id === integration.sourceId,
          );
          const owner = data?.users.find(
            (item) => item.id === integration.defaultOwnerId,
          );

          return (
            <article
              className={`integration-card status-${integration.status}`}
              key={integration.id}
            >
              <header>
                <span className="integration-logo">
                  <Webhook size={22} />
                </span>
                <div>
                  <h3>{integration.name}</h3>
                  <p>{integration.description || "Webhook genérico"}</p>
                </div>
                <span
                  className={`integration-status-pill status-${integration.status}`}
                >
                  <i /> {statusLabel[integration.status]}
                </span>
              </header>

              <div className="integration-card-content">
                <dl className="integration-details">
                  <div>
                    <dt>Destino</dt>
                    <dd>
                      {pipeline?.name || "Sem funil"}
                      <small>{stage?.name || "Sem etapa"}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Origem</dt>
                    <dd>{source?.name || integration.accountLabel}</dd>
                  </div>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{owner?.name || "Sem responsável padrão"}</dd>
                  </div>
                  <div>
                    <dt>Último evento</dt>
                    <dd>
                      {integration.lastEventAt
                        ? formatDateTime(integration.lastEventAt)
                        : "Nenhum evento"}
                      <small>{integration.eventsReceived} recebidos</small>
                    </dd>
                  </div>
                </dl>

                <div className="integration-endpoint">
                  <KeyRound size={15} />
                  <code>
                    {integration.publicKey} · {integration.secretMasked}
                  </code>
                </div>

                {integration.errors[0] ? (
                  <div className="integration-message error">
                    <AlertTriangle size={16} />
                    <span>{integration.errors[0]}</span>
                  </div>
                ) : (
                  <div className="integration-message success">
                    <ShieldCheck size={16} />
                    <span>Credencial protegida e roteamento salvo.</span>
                  </div>
                )}
              </div>

              <footer>
                <button
                  className="primary-button"
                  disabled={!canManage}
                  onClick={() => setSelected(integration)}
                >
                  <Settings2 size={16} /> Configurar
                </button>
              </footer>
            </article>
          );
        })}

        {integrations.length === 0 && (
          <article className="integration-card integration-empty-card">
            <div className="integration-card-content">
              <span className="integration-logo">
                <Webhook size={22} />
              </span>
              <h3>Nenhum webhook cadastrado</h3>
              <p>
                Crie a primeira entrada para um site, formulário, Make, n8n ou
                aplicação externa.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={!canManage}
                onClick={() => setCreating(true)}
              >
                <Plus size={16} /> Criar webhook
              </button>
            </div>
          </article>
        )}
      </div>

      <section className="panel technical-webhook-doc">
        <div className="webhook-doc-header">
          <span>
            <Webhook size={18} />
            <strong>Contrato previsto para a Etapa 4A.2</strong>
          </span>
        </div>
        <pre>{`POST ${webhookEndpoint()}
x-crm-integration-key: whk_...
Authorization: Bearer crm_...
Content-Type: application/json

{
  "name": "Lead de teste",
  "phone": "55999999999",
  "email": "teste@empresa.com",
  "external_id": "form-123"
}`}</pre>
      </section>

      {(creating || selected) && (
        <IntegrationModal
          integration={selected}
          onClose={() => {
            setCreating(false);
            setSelected(null);
          }}
          onCredentials={setCredentials}
        />
      )}

      {credentials && (
        <SecretModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}
