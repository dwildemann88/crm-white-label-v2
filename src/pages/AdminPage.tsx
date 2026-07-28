import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  BriefcaseBusiness,
  Database,
  ImagePlus,
  Layers3,
  LockKeyhole,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, EmptyState, PanelHead, RoleBadge } from "../components/Common";
import {
  customFieldSupportsOptions,
  customFieldTypeOptions,
  orderCustomFields,
} from "../core/customFields";
import { leadFieldTypeLabel, normalizeLeadField } from "../core/leadFields";
import type {
  Branding,
  CustomFieldDefinition,
  LeadFieldDefinition,
  Pipeline,
  PipelineStage,
  RoleKey,
  TagDefinition,
  User,
} from "../core/types";
import { fileToDataUrl, uid } from "../core/utils";

const newRecordId = (prefix: string) =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : uid(prefix);

type AdminSection = "users" | "pipelines" | "fields" | "branding" | "security";

const rolePresentation: Record<
  RoleKey,
  { label: string; description: string; tone: string }
> = {
  super_admin: {
    label: "Administrador",
    description: "Configura pessoas, processos, dados e integrações da organização.",
    tone: "violet",
  },
  manager: {
    label: "Gerente",
    description: "Coordena a equipe e acompanha toda a operação autorizada.",
    tone: "blue",
  },
  sales: {
    label: "Comercial",
    description: "Conduz oportunidades, tarefas e conversas da própria carteira.",
    tone: "green",
  },
  sdr: {
    label: "SDR",
    description: "Recebe, qualifica e encaminha oportunidades para o comercial.",
    tone: "amber",
  },
};

function accessSummary(user: User, pipelineNames: string[]) {
  if (!user.active) return "Acesso suspenso";
  if (user.isPlatformAdmin) return "Administração da plataforma e das organizações";
  if (user.role === "super_admin") return "Administração completa desta organização";
  if (!pipelineNames.length) return "Nenhum funil autorizado";
  if (pipelineNames.length === 1) return `Acesso ao funil ${pipelineNames[0]}`;
  return `Acesso a ${pipelineNames.length} funis`;
}

export function AdminPage({ onUser, initialPipelineId }: { onUser(id?: string): void; initialPipelineId?: string }) {
  const provider = import.meta.env.VITE_DATA_PROVIDER || "local";
  const isLocal = provider === "local";
  const {
    data,
  toggleUser,
  removeUser,
  savePipeline,
    deletePipeline,
    saveStage,
    deleteStage,
    saveLeadField,
    saveCustomField,
    deleteCustomField,
    saveTag,
    deleteTag,
    updateBranding,
    resetDemo,
  } = useCrm();

  const users = data?.users || [];
  const sourcePipelines = data?.pipelines || [];
  const sourceLeadFields = [...(data?.leadFields || [])].sort(
    (a, b) => a.position - b.position,
  );
  const sourceFields = useMemo(
    () => orderCustomFields(data?.customFields || []),
    [data?.customFields],
  );
  const sourceTags = data?.tags || [];
  const organization = data?.organizations.find(
    (item) => item.id === data.session?.organizationId,
  );

  const [activeSection, setActiveSection] = useState<AdminSection>("users");
  const [userSearch, setUserSearch] = useState("");
  const [userStatus, setUserStatus] = useState<"all" | "active" | "inactive">("all");
  const [selectedPipelineId, setSelectedPipelineId] = useState(
    sourcePipelines[0]?.id || "",
  );
  const selectedPipeline = sourcePipelines.find(
    (item) => item.id === selectedPipelineId,
  );
  const sourceStages = useMemo(
    () =>
      [...(data?.stages || [])]
        .filter((stage) => stage.pipelineId === selectedPipelineId)
        .sort((a, b) => a.order - b.order),
    [data?.stages, selectedPipelineId],
  );

  const [pipelineName, setPipelineName] = useState(selectedPipeline?.name || "");
  const [pipelineDescription, setPipelineDescription] = useState(
    selectedPipeline?.description || "",
  );
  const [pipelineActive, setPipelineActive] = useState(
    selectedPipeline?.active ?? true,
  );
  const [stages, setStages] = useState<PipelineStage[]>(sourceStages);
  const [leadFields, setLeadFields] =
    useState<LeadFieldDefinition[]>(sourceLeadFields);
  const [fields, setFields] = useState<CustomFieldDefinition[]>(sourceFields);
  const [tagDrafts, setTagDrafts] = useState<TagDefinition[]>(sourceTags);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2563eb");
  const [branding, setBranding] = useState<Branding>(
    organization?.branding || {
      productName: "CRM Comercial",
      companyName: "",
      logoUrl: "",
      primaryColor: "#2563eb",
      secondaryColor: "#172033",
      accentColor: "#0ea5e9",
      backgroundColor: "#f4f6fa",
      loginHeadline: "",
    },
  );

  useEffect(() => {
    if (initialPipelineId && sourcePipelines.some((item) => item.id === initialPipelineId)) {
      setSelectedPipelineId(initialPipelineId);
      setActiveSection("pipelines");
      return;
    }
    if (
      selectedPipelineId &&
      sourcePipelines.some((item) => item.id === selectedPipelineId)
    )
      return;
    setSelectedPipelineId(sourcePipelines[0]?.id || "");
  }, [initialPipelineId, selectedPipelineId, sourcePipelines]);

  useEffect(() => {
    setPipelineName(selectedPipeline?.name || "");
    setPipelineDescription(selectedPipeline?.description || "");
    setPipelineActive(selectedPipeline?.active ?? true);
  }, [selectedPipeline]);

  useEffect(() => setStages(sourceStages), [sourceStages]);
  useEffect(() => setLeadFields(sourceLeadFields), [data?.leadFields]);
  useEffect(() => setFields(sourceFields), [sourceFields]);
  useEffect(() => setTagDrafts(sourceTags), [sourceTags]);
  useEffect(() => {
    if (organization) setBranding(organization.branding);
  }, [organization]);

  const pipelineNameById = useMemo(
    () => new Map(sourcePipelines.map((pipeline) => [pipeline.id, pipeline.name])),
    [sourcePipelines],
  );

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return users.filter((user) => {
      if (userStatus === "active" && !user.active) return false;
      if (userStatus === "inactive" && user.active) return false;
      if (!query) return true;
      return `${user.name} ${user.email} ${user.roleLabel}`.toLowerCase().includes(query);
    });
  }, [userSearch, userStatus, users]);

  const activeUsers = users.filter((user) => user.active).length;
  const activePipelines = sourcePipelines.filter((pipeline) => pipeline.active).length;
  const configuredFields = sourceFields.filter((field) => field.active).length;
const removeOrganizationUser = async (user: User) => {
  if (user.id === data?.session?.userId) {
    window.alert(
      "Você não pode remover o próprio acesso à empresa.",
    );
    return;
  }

  const confirmed = window.confirm(
    `Remover “${user.name}” desta empresa?\n\n` +
      "A conta continuará existindo no Supabase, mas perderá o acesso a esta organização.\n\n" +
      "A remoção será bloqueada se ainda houver leads, conversas ou tarefas atribuídos ao usuário.",
  );

  if (!confirmed) return;

  await removeUser(user.id);
};
  const addPipeline = async () => {
    if (!data?.session) return;
    const pipeline: Pipeline = {
      id: newRecordId("pipe"),
      organizationId: data.session.organizationId,
      name: `Novo funil ${sourcePipelines.length + 1}`,
      description: "Fluxo comercial personalizável.",
      active: true,
    };
    await savePipeline(pipeline);
    setSelectedPipelineId(pipeline.id);
  };

  const persistPipeline = async () => {
    if (!selectedPipeline || !pipelineName.trim()) return;
    await savePipeline({
      ...selectedPipeline,
      name: pipelineName.trim(),
      description: pipelineDescription.trim(),
      active: pipelineActive,
    });
  };

  const removePipeline = async () => {
    if (!selectedPipeline) return;
    const confirmed = window.confirm(
      `Excluir o funil “${selectedPipeline.name}”? A operação será bloqueada se existirem leads ou integrações vinculados.`,
    );
    if (!confirmed) return;
    await deletePipeline(selectedPipeline.id);
  };

  const addStage = () => {
    if (!data?.session || !selectedPipelineId) return;
    setStages((old) => [
      ...old,
      {
        id: newRecordId("stage"),
        organizationId: data.session!.organizationId,
        pipelineId: selectedPipelineId,
        name: "Nova etapa",
        color: "#60a5fa",
        order: old.length + 1,
        kind: "open",
      },
    ]);
  };

  const changeStage = (id: string, patch: Partial<PipelineStage>) => {
    setStages((old) =>
      old.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
    );
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    setStages(
      next.map((stage, stageIndex) => ({ ...stage, order: stageIndex + 1 })),
    );
  };

  const persistStages = async () => {
    const normalized = stages.map((item, index) => ({
      ...item,
      name: item.name.trim(),
      order: index + 1,
    }));
    if (normalized.some((stage) => !stage.name)) return;
    for (const stage of normalized) await saveStage(stage);
  };

  const removeStage = async (stage: PipelineStage) => {
    const persisted = sourceStages.some((item) => item.id === stage.id);
    if (!persisted) {
      setStages((old) => old.filter((item) => item.id !== stage.id));
      return;
    }
    const confirmed = window.confirm(
      `Excluir a etapa “${stage.name}”? A operação será bloqueada se houver leads vinculados.`,
    );
    if (confirmed) await deleteStage(stage.id);
  };

  const changeLeadField = (
    key: LeadFieldDefinition["key"],
    patch: Partial<LeadFieldDefinition>,
  ) => {
    setLeadFields((old) =>
      old.map((field) =>
        field.key === key
          ? normalizeLeadField({ ...field, ...patch })
          : field,
      ),
    );
  };

  const moveLeadField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= leadFields.length) return;

    const next = [...leadFields];
    [next[index], next[target]] = [next[target], next[index]];

    setLeadFields(
      next.map((field, fieldIndex) => ({
        ...field,
        position: fieldIndex + 1,
      })),
    );
  };

  const persistLeadFields = async () => {
    if (leadFields.some((field) => !field.label.trim())) return;

    for (const field of leadFields) {
      await saveLeadField(
        normalizeLeadField({
          ...field,
          label: field.label.trim(),
        }),
      );
    }
  };

  const addField = () => {
    if (!data?.session) return;
    setFields((old) => [
      ...old,
      {
        id: newRecordId("field"),
        organizationId: data.session!.organizationId,
        name: "Novo campo",
        key: `campo_${old.length + 1}`,
        type: "text",
        options: [],
        required: false,
        active: true,
        showInTable: false,
        position:
          old.reduce((highest, field) => Math.max(highest, field.position), 0) + 1,
        pipelineId: null,
      },
    ]);
  };

  const changeField = (id: string, patch: Partial<CustomFieldDefinition>) => {
    setFields((old) =>
      old.map((field) => {
        if (field.id !== id) return field;
        const next = { ...field, ...patch };
        return {
          ...next,
          options: customFieldSupportsOptions(next.type) ? next.options : [],
        };
      }),
    );
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;

    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(
      next.map((field, fieldIndex) => ({
        ...field,
        position: fieldIndex + 1,
      })),
    );
  };

  const customFieldsAreValid = fields.every((field) => {
    if (!field.name.trim() || !field.key.trim()) return false;
    if (!customFieldSupportsOptions(field.type)) return true;
    return field.options.some((option) => option.trim());
  });

  const persistFields = async () => {
    if (!customFieldsAreValid) return;

    const normalized = fields.map((field, index) => ({
      ...field,
      name: field.name.trim(),
      key: field.key.trim(),
      position: index + 1,
      pipelineId: field.pipelineId || null,
      options: customFieldSupportsOptions(field.type)
        ? Array.from(
            new Set(field.options.map((option) => option.trim()).filter(Boolean)),
          )
        : [],
    }));

    for (const field of normalized) await saveCustomField(field);
  };

  const removeField = async (field: CustomFieldDefinition) => {
    if (!sourceFields.some((item) => item.id === field.id)) {
      setFields((old) =>
        old
          .filter((item) => item.id !== field.id)
          .map((item, index) => ({ ...item, position: index + 1 })),
      );
      return;
    }
    const confirmed = window.confirm(
      `Excluir o campo “${field.name}”? Valores já preenchidos também podem ser removidos.`,
    );
    if (confirmed) await deleteCustomField(field.id);
  };

  const addTag = async () => {
    if (!newTag.trim() || !data?.session) return;
    await saveTag({
      id: newRecordId("tag"),
      organizationId: data.session.organizationId,
      name: newTag.trim(),
      color: newTagColor,
    });
    setNewTag("");
  };

  const persistTag = async (tag: TagDefinition) => {
    if (!tag.name.trim()) return;
    await saveTag({ ...tag, name: tag.name.trim() });
  };

  const sectionItems: Array<{
    id: AdminSection;
    label: string;
    description: string;
    icon: typeof Users;
  }> = [
    {
      id: "users",
      label: "Usuários e acessos",
      description: "Pessoas, funções e escopo",
      icon: Users,
    },
    {
      id: "pipelines",
      label: "Funis e etapas",
      description: "Processo comercial",
      icon: BriefcaseBusiness,
    },
    {
      id: "fields",
      label: "Campos e etiquetas",
      description: "Estrutura dos dados",
      icon: Database,
    },
    {
      id: "branding",
      label: "Identificação",
      description: "Nome e logo da empresa",
      icon: Layers3,
    },
    {
      id: "security",
      label: "Segurança",
      description: "Sessão e ambiente",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="admin-page-v5">
      <section className="admin-intro-bar">
        <div>
          <Settings2 size={18} />
          <span>
            <strong>Configuração sem dependência de código</strong>
            <small>Altere pessoas, processo comercial e estrutura de dados diretamente pela organização ativa.</small>
          </span>
        </div>
        <button className="primary-button" onClick={() => onUser()}>
          <UserPlus size={17} /> Convidar usuário
        </button>
      </section>

      <section className="admin-summary-grid" aria-label="Resumo da configuração">
        <article>
          <span className="summary-icon blue"><Users size={19} /></span>
          <div><small>Usuários ativos</small><strong>{activeUsers}</strong><p>{users.length} cadastrados</p></div>
        </article>
        <article>
          <span className="summary-icon violet"><BriefcaseBusiness size={19} /></span>
          <div><small>Funis ativos</small><strong>{activePipelines}</strong><p>{sourcePipelines.length} configurados</p></div>
        </article>
        <article>
          <span className="summary-icon green"><Database size={19} /></span>
          <div><small>Campos ativos</small><strong>{configuredFields}</strong><p>{sourceTags.length} etiquetas</p></div>
        </article>
        <article>
          <span className="summary-icon amber"><CheckCircle2 size={19} /></span>
          <div><small>Organização</small><strong className="summary-text-value">{organization?.name || "—"}</strong><p>{organization?.active ? "Operação ativa" : "Operação inativa"}</p></div>
        </article>
      </section>

      <div className="admin-workspace">
        <nav className="admin-section-nav" aria-label="Seções administrativas">
          {sectionItems.map(({ id, label, description, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={activeSection === id ? "active" : ""}
              onClick={() => setActiveSection(id)}
            >
              <span><Icon size={18} /></span>
              <div><strong>{label}</strong><small>{description}</small></div>
            </button>
          ))}
        </nav>

        <main className="admin-section-content">
          {activeSection === "users" && (
            <section className="panel admin-section-panel">
              <PanelHead
                title="Usuários e níveis de acesso"
                subtitle="Cada pessoa recebe uma função e acesso somente aos funis necessários."
                action={
                  <button className="primary-button" onClick={() => onUser()}>
                    <UserPlus size={17} /> Convidar usuário
                  </button>
                }
              />

              <div className="admin-guidance-strip">
                <ShieldCheck size={18} />
                <div>
                  <strong>Acesso orientado por função e funil</strong>
                  <span>
                    O cargo define as ações permitidas; o escopo de funis limita
                    onde o usuário pode atuar e assumir leads.
                  </span>
                </div>
              </div>

              <div className="admin-user-toolbar">
                <label className="search-control grow">
                  <Search size={16} />
                  <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou função" />
                </label>
                <div className="segmented-control" aria-label="Filtrar usuários por status">
                  <button type="button" className={userStatus === "all" ? "active" : ""} onClick={() => setUserStatus("all")}>Todos <b>{users.length}</b></button>
                  <button type="button" className={userStatus === "active" ? "active" : ""} onClick={() => setUserStatus("active")}>Ativos <b>{activeUsers}</b></button>
                  <button type="button" className={userStatus === "inactive" ? "active" : ""} onClick={() => setUserStatus("inactive")}>Inativos <b>{users.length - activeUsers}</b></button>
                </div>
              </div>

              <div className="admin-user-list">
                {filteredUsers.map((user) => {
                  const pipelineNames = user.pipelineIds
                    .map((id) => pipelineNameById.get(id))
                    .filter((name): name is string => Boolean(name));
                  const role = rolePresentation[user.role];
                  return (
                    <article className="admin-user-card" key={user.id}>
                      <div className="admin-user-identity">
                        <Avatar user={user} />
                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>

                      <div className="admin-user-role">
                        <RoleBadge role={user.role} label={role.label} />
                        <small>{role.description}</small>
                      </div>

                      <div className="admin-user-access">
                        <strong>{accessSummary(user, pipelineNames)}</strong>
                        <span>
                          {pipelineNames.length
                            ? pipelineNames.join(" · ")
                            : "Revise o acesso antes de atribuir oportunidades."}
                        </span>
                      </div>

                      <div className="admin-user-permissions">
                        <small>Permissões efetivas</small>
                        <strong>
                          {user.isPlatformAdmin
                            ? "Plataforma"
                            : user.permissions
                              ? `${user.permissions.length} regras`
                              : "Padrão do perfil"}
                        </strong>
                      </div>

                      <div className="admin-user-actions">
                        <button
                          type="button"
                          className={`status-toggle ${user.active ? "active" : ""}`}
                          onClick={() => void toggleUser(user.id)}
                          aria-label={user.active ? "Suspender acesso" : "Ativar acesso"}
                        >
                          <span /> {user.active ? "Ativo" : "Inativo"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={() => onUser(user.id)}
                        >
                          Editar acesso
                        </button>
                        <button
  type="button"
  className="icon-danger"
  onClick={() =>
    void removeOrganizationUser(user)
  }
  disabled={
    user.id === data?.session?.userId
  }
  aria-label={`Remover ${user.name} da empresa`}
  title={
    user.id === data?.session?.userId
      ? "Você não pode remover o próprio acesso."
      : "Remover usuário da empresa"
  }
>
  <Trash2 size={16} />
</button>
                      </div>
                    </article>
                  );
                })}
                {!filteredUsers.length && (
                  <EmptyState
                    icon={Users}
                    title={users.length ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                    text={users.length ? "Ajuste a busca ou o filtro de status." : "Convide a primeira pessoa e defina sua função e seus funis autorizados."}
                  />
                )}
              </div>
            </section>
          )}

          {activeSection === "pipelines" && (
            <div className="admin-section-stack">
              <section className="panel admin-section-panel">
                <PanelHead
                  title="Funis comerciais"
                  subtitle="Separe operações distintas e mantenha cada processo organizado."
                  action={
                    <button className="secondary-button" onClick={() => void addPipeline()}>
                      <Plus size={16} /> Novo funil
                    </button>
                  }
                />

                <div className="pipeline-config-layout">
                  <aside className="pipeline-selector-list">
                    {sourcePipelines.map((pipeline) => {
                      const stageCount = (data?.stages || []).filter(
                        (stage) => stage.pipelineId === pipeline.id,
                      ).length;
                      const leadCount = (data?.leads || []).filter(
                        (lead) => lead.pipelineId === pipeline.id,
                      ).length;
                      return (
                        <button
                          type="button"
                          key={pipeline.id}
                          className={selectedPipelineId === pipeline.id ? "active" : ""}
                          onClick={() => setSelectedPipelineId(pipeline.id)}
                        >
                          <span className="pipeline-status-dot" data-active={pipeline.active} />
                          <div><strong>{pipeline.name}</strong><small>{stageCount} etapas · {leadCount} leads</small></div>
                        </button>
                      );
                    })}
                    {!sourcePipelines.length && (
                      <p className="muted padded">Nenhum funil configurado.</p>
                    )}
                  </aside>

                  <div className="pipeline-settings-form">
                    <div className="section-field-grid">
                      <label>
                        <span>Nome do funil</span>
                        <input
                          value={pipelineName}
                          onChange={(event) => setPipelineName(event.target.value)}
                          disabled={!selectedPipeline}
                        />
                      </label>
                      <label>
                        <span>Status</span>
                        <select
                          value={pipelineActive ? "active" : "inactive"}
                          onChange={(event) => setPipelineActive(event.target.value === "active")}
                          disabled={!selectedPipeline}
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                        </select>
                      </label>
                      <label className="full-field">
                        <span>Descrição</span>
                        <textarea
                          value={pipelineDescription}
                          onChange={(event) => setPipelineDescription(event.target.value)}
                          disabled={!selectedPipeline}
                          rows={3}
                          placeholder="Explique para qual operação este funil será usado."
                        />
                      </label>
                    </div>
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        className="danger-ghost-button"
                        onClick={() => void removePipeline()}
                        disabled={!selectedPipeline || sourcePipelines.length <= 1}
                      >
                        <Trash2 size={16} /> Excluir funil
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void persistPipeline()}
                        disabled={!selectedPipeline || !pipelineName.trim()}
                      >
                        <Save size={16} /> Salvar alterações
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel admin-section-panel">
                <PanelHead
                  title="Etapas do funil"
                  subtitle={
                    selectedPipeline
                      ? `Organize a jornada de ${selectedPipeline.name} na ordem em que o time trabalha.`
                      : "Selecione um funil para configurar suas etapas."
                  }
                  action={
                    <div className="panel-actions">
                      <button className="secondary-button" onClick={addStage} disabled={!selectedPipelineId}>
                        <Plus size={16} /> Adicionar etapa
                      </button>
                      <button
                        className="primary-button"
                        onClick={() => void persistStages()}
                        disabled={!selectedPipelineId || !stages.length || stages.some((stage) => !stage.name.trim())}
                      >
                        <Save size={16} /> Salvar etapas
                      </button>
                    </div>
                  }
                />

                <div className="stage-editor-v5">
                  <div className="stage-editor-head">
                    <span>Ordem</span><span>Cor</span><span>Nome da etapa</span><span>Resultado</span><span>Ações</span>
                  </div>
                  {stages.map((stage, index) => (
                    <div className="stage-editor-row" key={stage.id}>
                      <div className="stage-position-control">
                        <strong>{index + 1}</strong>
                        <span>
                          <button type="button" disabled={index === 0} onClick={() => moveStage(index, -1)} aria-label="Mover para cima"><ArrowUp size={14} /></button>
                          <button type="button" disabled={index === stages.length - 1} onClick={() => moveStage(index, 1)} aria-label="Mover para baixo"><ArrowDown size={14} /></button>
                        </span>
                      </div>
                      <label className="semantic-color-control" title="Cor de identificação da etapa">
                        <i style={{ background: stage.color }} />
                        <input type="color" value={stage.color} onChange={(event) => changeStage(stage.id, { color: event.target.value })} />
                      </label>
                      <input value={stage.name} onChange={(event) => changeStage(stage.id, { name: event.target.value })} aria-label="Nome da etapa" />
                      <select value={stage.kind} onChange={(event) => changeStage(stage.id, { kind: event.target.value as PipelineStage["kind"] })} aria-label="Tipo da etapa">
                        <option value="open">Em andamento</option>
                        <option value="won">Negócio ganho</option>
                        <option value="lost">Negócio perdido</option>
                      </select>
                      <button type="button" className="icon-danger" onClick={() => void removeStage(stage)} aria-label="Excluir etapa"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {!stages.length && (
                    <EmptyState icon={Layers3} title="Nenhuma etapa configurada" text="Adicione as etapas na ordem real do seu processo comercial." />
                  )}
                </div>
              </section>
            </div>
          )}

          {activeSection === "fields" && (
            <div className="admin-section-stack">
              <section className="panel admin-section-panel">
                <PanelHead
                  title="Campos padrão do lead"
                  subtitle="Altere os nomes, a ordem e a exibição dos campos estruturais sem modificar o banco de dados."
                  action={
                    <button
                      className="primary-button"
                      onClick={() => void persistLeadFields()}
                      disabled={leadFields.some((field) => !field.label.trim())}
                    >
                      <Save size={16} /> Salvar campos padrão
                    </button>
                  }
                />

                <div className="lead-field-editor-v5">
                  <div className="lead-field-head">
                    <span>Ordem</span>
                    <span>Nome exibido</span>
                    <span>Campo interno</span>
                    <span>Tipo</span>
                    <span>Exibição</span>
                  </div>

                  {leadFields.map((field, index) => (
                    <div className="lead-field-row" key={field.key}>
                      <div className="stage-position-control">
                        <strong>{index + 1}</strong>
                        <span>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveLeadField(index, -1)}
                            aria-label={`Mover ${field.label} para cima`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === leadFields.length - 1}
                            onClick={() => moveLeadField(index, 1)}
                            aria-label={`Mover ${field.label} para baixo`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </span>
                      </div>

                      <input
                        value={field.label}
                        onChange={(event) =>
                          changeLeadField(field.key, {
                            label: event.target.value,
                          })
                        }
                        aria-label={`Nome exibido de ${field.key}`}
                      />

                      <code>{field.key}</code>
                      <span className="lead-field-type">
                        {leadFieldTypeLabel(field.type)}
                      </span>

                      <div className="field-visibility-controls">
                        <label>
                          <input
                            type="checkbox"
                            checked={field.active}
                            disabled={field.locked}
                            onChange={(event) =>
                              changeLeadField(field.key, {
                                active: event.target.checked,
                              })
                            }
                          />
                          Ativo
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={field.required}
                            disabled={field.locked || !field.active}
                            onChange={(event) =>
                              changeLeadField(field.key, {
                                required: event.target.checked,
                              })
                            }
                          />
                          Obrigatório
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={field.showInTable}
                            disabled={!field.active}
                            onChange={(event) =>
                              changeLeadField(field.key, {
                                showInTable: event.target.checked,
                              })
                            }
                          />
                          Na tabela
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="admin-field-note">
                  O campo de identificação principal permanece ativo e obrigatório
                  para preservar a integridade dos contatos e oportunidades.
                </p>
              </section>

              <section className="panel admin-section-panel">
                <PanelHead
                  title="Campos personalizados"
                  subtitle="Crie campos específicos da operação, defina a ordem e escolha se cada campo vale para todos os funis ou somente para um processo."
                  action={
                    <div className="panel-actions">
                      <button className="secondary-button" onClick={addField}>
                        <Plus size={16} /> Novo campo
                      </button>
                      <button
                        className="primary-button"
                        onClick={() => void persistFields()}
                        disabled={!customFieldsAreValid}
                      >
                        <Save size={16} /> Salvar campos
                      </button>
                    </div>
                  }
                />

                <div className="custom-field-editor-v5">
                  <div className="custom-field-head">
                    <span>Ordem</span>
                    <span>Campo</span>
                    <span>Identificador</span>
                    <span>Tipo</span>
                    <span>Aplicação</span>
                    <span>Opções</span>
                    <span>Exibição</span>
                    <span />
                  </div>
                  {fields.map((field, index) => (
                    <div className="custom-field-row" key={field.id}>
                      <div className="stage-position-control">
                        <strong>{index + 1}</strong>
                        <span>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveField(index, -1)}
                            aria-label={`Mover ${field.name} para cima`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === fields.length - 1}
                            onClick={() => moveField(index, 1)}
                            aria-label={`Mover ${field.name} para baixo`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </span>
                      </div>

                      <input
                        value={field.name}
                        onChange={(event) =>
                          changeField(field.id, { name: event.target.value })
                        }
                        placeholder="Nome do campo"
                      />

                      <input
                        value={field.key}
                        disabled={sourceFields.some((item) => item.id === field.id)}
                        title={
                          sourceFields.some((item) => item.id === field.id)
                            ? "O identificador é preservado depois que o campo é criado."
                            : "Use letras minúsculas, números e sublinhado."
                        }
                        onChange={(event) =>
                          changeField(field.id, {
                            key: event.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, "_"),
                          })
                        }
                        placeholder="identificador"
                      />

                      <select
                        value={field.type}
                        onChange={(event) =>
                          changeField(field.id, {
                            type: event.target.value as CustomFieldDefinition["type"],
                          })
                        }
                        aria-label={`Tipo do campo ${field.name}`}
                      >
                        {customFieldTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={field.pipelineId ?? ""}
                        onChange={(event) =>
                          changeField(field.id, {
                            pipelineId: event.target.value || null,
                          })
                        }
                        aria-label={`Funil do campo ${field.name}`}
                      >
                        <option value="">Todos os funis</option>
                        {sourcePipelines.map((pipeline) => (
                          <option key={pipeline.id} value={pipeline.id}>
                            {pipeline.name}
                          </option>
                        ))}
                      </select>

                      <input
                        value={field.options.join(", ")}
                        disabled={!customFieldSupportsOptions(field.type)}
                        onChange={(event) =>
                          changeField(field.id, {
                            options: event.target.value
                              .split(",")
                              .map((item) => item.trim()),
                          })
                        }
                        placeholder={
                          customFieldSupportsOptions(field.type)
                            ? "Opção 1, Opção 2"
                            : "Não aplicável"
                        }
                      />

                      <div className="field-visibility-controls">
                        <label>
                          <input
                            type="checkbox"
                            checked={field.active}
                            onChange={(event) =>
                              changeField(field.id, { active: event.target.checked })
                            }
                          />
                          Ativo
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) =>
                              changeField(field.id, { required: event.target.checked })
                            }
                          />
                          Obrigatório
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={field.showInTable}
                            onChange={(event) =>
                              changeField(field.id, {
                                showInTable: event.target.checked,
                              })
                            }
                          />
                          Na tabela
                        </label>
                      </div>

                      <button
                        type="button"
                        className="icon-danger"
                        onClick={() => void removeField(field)}
                        aria-label="Excluir campo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {!fields.length && (
                    <EmptyState
                      icon={Database}
                      title="Nenhum campo personalizado"
                      text="Crie apenas campos que serão usados pela equipe e nas integrações."
                    />
                  )}
                </div>

                <p className="admin-field-note">
                  Campos vinculados a um funil aparecem somente nos leads daquele
                  processo. O identificador interno será usado futuramente no
                  mapeamento de formulários, webhooks e integrações.
                </p>
              </section>

              <section className="panel admin-section-panel">
                <PanelHead title="Etiquetas" subtitle="Use etiquetas para classificar leads sem alterar a etapa do funil." />
                <div className="tag-management-list">
                  {tagDrafts.map((tag) => (
                    <div className="tag-management-row" key={tag.id}>
                      <label className="semantic-color-control" title="Cor da etiqueta"><i style={{ background: tag.color }} /><input type="color" value={tag.color} onChange={(event) => setTagDrafts((old) => old.map((item) => item.id === tag.id ? { ...item, color: event.target.value } : item))} /></label>
                      <input value={tag.name} onChange={(event) => setTagDrafts((old) => old.map((item) => item.id === tag.id ? { ...item, name: event.target.value } : item))} />
                      <span className="tag-preview" style={{ "--tag-color": tag.color } as React.CSSProperties}><i />{tag.name || "Sem nome"}</span>
                      <button type="button" className="secondary-button compact" onClick={() => void persistTag(tag)} disabled={!tag.name.trim()}><Save size={15} /> Salvar</button>
                      <button type="button" className="icon-danger" onClick={() => { if (window.confirm(`Excluir a etiqueta “${tag.name}”?`)) void deleteTag(tag.id); }} aria-label="Excluir etiqueta"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {!tagDrafts.length && <p className="muted padded">Nenhuma etiqueta configurada.</p>}
                </div>
                <div className="tag-create-row">
                  <div><strong>Criar etiqueta</strong><span>Defina um nome curto e uma cor fácil de reconhecer.</span></div>
                  <label className="semantic-color-control"><i style={{ background: newTagColor }} /><input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} /></label>
                  <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Ex.: Fatura recebida" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTag(); } }} />
                  <button type="button" className="primary-button" onClick={() => void addTag()} disabled={!newTag.trim()}><Plus size={16} /> Criar etiqueta</button>
                </div>
              </section>
            </div>
          )}

          {activeSection === "branding" && (
            <section className="panel admin-section-panel">
              <PanelHead title="Identificação da empresa" subtitle="Personalize a marca exibida sem comprometer o padrão visual e a acessibilidade do produto." />
              <div className="branding-layout-v5">
                <div className="branding-preview-v5">
                  <div className="branding-preview-sidebar">
                    <span className="preview-logo">
                      {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" /> : <strong>{branding.productName.slice(0, 2).toUpperCase()}</strong>}
                    </span>
                    <div><strong>{branding.productName || "CRM Comercial"}</strong><small>{branding.companyName || organization?.name || "Empresa"}</small></div>
                  </div>
                  <div className="branding-preview-content">
                    <span className="branding-preview-title" />
                    <div><i /><i /><i /></div>
                    <span className="branding-preview-table" />
                  </div>
                </div>

                <div className="branding-form-v5">
                  <label><span>Nome exibido no CRM</span><input value={branding.productName} onChange={(event) => setBranding((old) => ({ ...old, productName: event.target.value }))} /></label>
                  <label><span>Nome da empresa</span><input value={branding.companyName} onChange={(event) => setBranding((old) => ({ ...old, companyName: event.target.value }))} /></label>
                  <label><span>URL da logo</span><input value={branding.logoUrl} onChange={(event) => setBranding((old) => ({ ...old, logoUrl: event.target.value }))} placeholder="https://... ou selecione um arquivo" /></label>
                  <label><span>Arquivo da logo</span><span className="file-input-button"><ImagePlus size={16} /> Selecionar imagem<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const logoUrl = await fileToDataUrl(file); setBranding((old) => ({ ...old, logoUrl })); }} /></span></label>
                  <div className="configuration-note full-field"><SlidersHorizontal size={17} /><div><strong>Sistema visual fixo</strong><span>Cores, contraste, tipografia, espaçamento e componentes permanecem iguais em todas as empresas. Isso protege a usabilidade e evita interfaces inconsistentes.</span></div></div>
                  <div className="admin-form-actions full-field"><button className="primary-button" onClick={() => void updateBranding(branding)} disabled={!branding.productName.trim()}><Save size={16} /> Salvar identificação</button></div>
                </div>
              </div>
            </section>
          )}

          {activeSection === "security" && (
            <section className="panel admin-section-panel">
              <PanelHead title="Segurança e ambiente" subtitle={isLocal ? "Ferramentas exclusivas do ambiente local." : "Resumo das camadas que protegem a organização ativa."} />
              <div className="security-grid-v5">
                <article><span className="summary-icon green"><ShieldCheck size={20} /></span><div><strong>Isolamento por organização</strong><p>As consultas e operações respeitam o vínculo do usuário com a organização ativa.</p></div><b>Ativo</b></article>
                <article><span className="summary-icon blue"><LockKeyhole size={20} /></span><div><strong>Permissões efetivas</strong><p>A interface e as RPCs validam as ações autorizadas para cada função.</p></div><b>Ativo</b></article>
                <article><span className="summary-icon violet"><LockKeyhole size={20} /></span><div><strong>Sessão autenticada</strong><p>O acesso é associado à conta do usuário e ao escopo de dados permitido.</p></div><b>Ativo</b></article>
                <article><span className="summary-icon amber"><RefreshCcw size={20} /></span><div><strong>Sincronização</strong><p>Dados operacionais são atualizados pelo gateway e pelos eventos conectados.</p></div><b>Ativo</b></article>
              </div>
              {isLocal && (
                <div className="local-reset-zone">
                  <div><strong>Restaurar dados locais</strong><span>Use somente para reiniciar os dados de desenvolvimento deste navegador.</span></div>
                  <button className="danger-button" onClick={() => void resetDemo()}><RefreshCcw size={16} /> Restaurar ambiente local</button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
