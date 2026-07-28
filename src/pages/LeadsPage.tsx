import {
  AlertCircle,
  CalendarRange,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  KanbanSquare,
  Plus,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, OriginBadge, PriorityBadge, SelectControl } from "../components/Common";
import { canUserOwnLead } from "../core/crmConsistency";
import type { LeadListPreset, LeadSpecialFilter } from "../core/leadFilters";
import { resolveLeadFields } from "../core/leadFields";
import type {
  CustomFieldDefinition,
  Lead,
  LeadFieldDefinition,
  LeadFieldKey,
  LeadTemperature,
} from "../core/types";
import { currency, downloadCsv, formatDateTime } from "../core/utils";

const OPERATIONAL_COLUMNS_KEY = "crm-product-leads-operational-columns-v3";
const STANDARD_COLUMNS_KEY = "crm-product-leads-standard-columns-v3";
const CUSTOM_COLUMNS_KEY = "crm-product-leads-custom-columns-v3";

type OperationalColumnKey = "stage" | "owner" | "lastContact";
type OperationalColumns = Record<OperationalColumnKey, boolean>;

const defaultOperationalColumns: OperationalColumns = {
  stage: true,
  owner: true,
  lastContact: true,
};

const operationalColumnLabels: Record<OperationalColumnKey, string> = {
  stage: "Etapa",
  owner: "Responsável",
  lastContact: "Última interação",
};

interface LeadsPageProps {
  onLead(id: string): void;
  onAdd(): void;
  initialSearch?: string;
  preset?: LeadListPreset | null;
  onSearchApplied?(): void;
}

function readStoredColumns<T extends Record<string, boolean>>(
  key: string,
  fallback: T,
): T {
  try {
    const saved = localStorage.getItem(key);
    return saved
      ? { ...fallback, ...(JSON.parse(saved) as Partial<T>) }
      : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function standardFieldValue(lead: Lead, key: LeadFieldKey): string | number {
  return lead[key] as string | number;
}

function standardFieldExportValue(lead: Lead, field: LeadFieldDefinition) {
  const value = standardFieldValue(lead, field.key);
  if (field.key === "value") return Number(value) || 0;
  if (field.key === "score") return Number(value) || 0;
  return value ?? "";
}

function renderStandardFieldCell(
  lead: Lead,
  field: LeadFieldDefinition,
): ReactNode {
  const value = standardFieldValue(lead, field.key);

  switch (field.key) {
    case "origin":
      return String(value || "").trim() ? (
        <OriginBadge origin={String(value)} />
      ) : (
        "—"
      );
    case "priority":
      return <PriorityBadge value={lead.priority} />;
    case "temperature":
      return (
        <span className={`temperature-badge temperature-${lead.temperature.toLowerCase()}`}>
          {lead.temperature}
        </span>
      );
    case "score":
      return <strong>{lead.score}<span className="cell-subtitle inline">/100</span></strong>;
    case "value":
      return <strong>{currency(lead.value)}</strong>;
    case "notes": {
      const notes = lead.notes.trim();
      if (!notes) return "—";
      const compact = notes.replace(/\s+/g, " ");
      return <span title={compact}>{compact.length > 72 ? `${compact.slice(0, 72)}…` : compact}</span>;
    }
    default:
      return String(value || "").trim() || "—";
  }
}

function customFieldValue(field: CustomFieldDefinition, lead: Lead) {
  const value = lead.customValues?.[field.key];
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value ?? "—");
}

export function LeadsPage({
  onLead,
  onAdd,
  initialSearch = "",
  preset,
  onSearchApplied,
}: LeadsPageProps) {
  const { data, visibleLeads, can } = useCrm();
  const organizationId = data?.session?.organizationId || "sem-organizacao";
  const pipelines = (data?.pipelines || []).filter((item) => item.active);
  const stages = [...(data?.stages || [])].sort((a, b) => a.order - b.order);
  const users = (data?.users || []).filter((user) => user.active);
  const tags = data?.tags || [];
  const organization = data?.organizations.find((item) => item.id === organizationId);
  const configuredLeadFields = useMemo(
    () => resolveLeadFields(data?.leadFields || [], organizationId),
    [data?.leadFields, organizationId],
  );
  const activeLeadFields = configuredLeadFields.filter((field) => field.active);
  const nameField = configuredLeadFields.find((field) => field.key === "name")!;
  const tableLeadFields = configuredLeadFields.filter(
    (field) => field.active && field.showInTable && field.key !== "name",
  );
  const customFields = (data?.customFields || []).filter((field) => field.active);
  const tableCustomFields = customFields.filter((field) => field.showInTable);

  const [search, setSearch] = useState(initialSearch);
  const [pipeline, setPipeline] = useState("Todos");
  const [stage, setStage] = useState("Todas");
  const [owner, setOwner] = useState("Todos");
  const [origin, setOrigin] = useState("Todas");
  const [priority, setPriority] = useState("Todas");
  const [temperature, setTemperature] = useState<LeadTemperature | "Todas">("Todas");
  const [tag, setTag] = useState("Todas");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [special, setSpecial] = useState<LeadSpecialFilter | "">("");
  const [specialLabel, setSpecialLabel] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnsScope, setColumnsScope] = useState("");
  const [operationalVisible, setOperationalVisible] = useState<OperationalColumns>({
    ...defaultOperationalColumns,
  });
  const [standardVisible, setStandardVisible] = useState<Record<string, boolean>>({});
  const [customVisible, setCustomVisible] = useState<Record<string, boolean>>({});

  const fieldIsActive = (key: LeadFieldKey) =>
    configuredLeadFields.some((field) => field.key === key && field.active);
  const fieldLabel = (key: LeadFieldKey) =>
    configuredLeadFields.find((field) => field.key === key)?.label || key;

  useEffect(() => {
    if (!initialSearch) return;
    setSearch(initialSearch);
    onSearchApplied?.();
  }, [initialSearch, onSearchApplied]);

  useEffect(() => {
    if (!preset) return;
    setPipeline(preset.pipelineId || "Todos");
    setStage(preset.stageId || "Todas");
    setOwner(preset.ownerId || "Todos");
    setOrigin(preset.origin || "Todas");
    setTemperature(preset.temperature || "Todas");
    setDateFrom(preset.dateFrom || "");
    setDateTo(preset.dateTo || "");
    setSpecial(preset.special || "");
    setSpecialLabel(preset.label || "");
    setAdvancedOpen(Boolean(preset.origin || preset.temperature || preset.dateFrom || preset.dateTo || preset.special));
  }, [preset?.id]);

  useEffect(() => {
    const operationalKey = `${OPERATIONAL_COLUMNS_KEY}:${organizationId}`;
    const standardKey = `${STANDARD_COLUMNS_KEY}:${organizationId}`;
    const customKey = `${CUSTOM_COLUMNS_KEY}:${organizationId}`;
    const standardDefaults = Object.fromEntries(
      tableLeadFields.map((field) => [field.key, true]),
    );
    const customDefaults = Object.fromEntries(
      tableCustomFields.map((field) => [field.id, true]),
    );

    setOperationalVisible(
      readStoredColumns(operationalKey, defaultOperationalColumns),
    );
    setStandardVisible(readStoredColumns(standardKey, standardDefaults));
    setCustomVisible(readStoredColumns(customKey, customDefaults));
    setColumnsScope(organizationId);
  }, [
    organizationId,
    tableLeadFields.map((field) => field.key).join("|"),
    tableCustomFields.map((field) => field.id).join("|"),
  ]);

  useEffect(() => {
    if (columnsScope !== organizationId) return;
    localStorage.setItem(
      `${OPERATIONAL_COLUMNS_KEY}:${organizationId}`,
      JSON.stringify(operationalVisible),
    );
  }, [columnsScope, operationalVisible, organizationId]);

  useEffect(() => {
    if (columnsScope !== organizationId) return;
    localStorage.setItem(
      `${STANDARD_COLUMNS_KEY}:${organizationId}`,
      JSON.stringify(standardVisible),
    );
  }, [columnsScope, standardVisible, organizationId]);

  useEffect(() => {
    if (columnsScope !== organizationId) return;
    localStorage.setItem(
      `${CUSTOM_COLUMNS_KEY}:${organizationId}`,
      JSON.stringify(customVisible),
    );
  }, [columnsScope, customVisible, organizationId]);

  useEffect(() => {
    if (!fieldIsActive("origin")) setOrigin("Todas");
    if (!fieldIsActive("priority")) setPriority("Todas");
    if (!fieldIsActive("temperature")) setTemperature("Todas");
  }, [configuredLeadFields]);

  const origins = useMemo(
    () => Array.from(new Set(visibleLeads.map((lead) => lead.origin).filter(Boolean))).sort(),
    [visibleLeads],
  );
  const availableOwners = useMemo(
    () => users.filter((user) => pipeline === "Todos" || canUserOwnLead(user, pipeline)),
    [pipeline, users],
  );

  useEffect(() => {
    if (owner === "Todos" || availableOwners.some((user) => user.id === owner)) return;
    setOwner("Todos");
  }, [availableOwners, owner]);

  const overdueLeadIds = useMemo(
    () => new Set((data?.tasks || []).filter((task) => {
      if (!task.leadId || task.done) return false;
      const scheduled = new Date(`${task.date}T${task.time || "23:59"}:00`).getTime();
      return Number.isFinite(scheduled) && scheduled < Date.now();
    }).map((task) => task.leadId as string)),
    [data?.tasks],
  );
  const unreadLeadIds = useMemo(
    () => new Set((data?.conversations || []).filter((conversation) => conversation.unread > 0).map((conversation) => conversation.leadId)),
    [data?.conversations],
  );
  const pendingTaskLeadIds = useMemo(
    () => new Set((data?.tasks || []).filter((task) => task.leadId && !task.done).map((task) => task.leadId as string)),
    [data?.tasks],
  );
  const openStageIds = useMemo(
    () => new Set(stages.filter((item) => item.kind === "open").map((item) => item.id)),
    [stages],
  );
  const wonStageIds = useMemo(
    () => new Set(stages.filter((item) => item.kind === "won").map((item) => item.id)),
    [stages],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleLeads.filter((lead) => {
      const searchable = activeLeadFields
        .map((field) => String(standardFieldValue(lead, field.key) ?? ""))
        .join(" ")
        .toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (pipeline === "Todos" || lead.pipelineId === pipeline) &&
        (stage === "Todas" || lead.stageId === stage) &&
        (owner === "Todos" || lead.ownerId === owner) &&
        (origin === "Todas" || lead.origin === origin) &&
        (priority === "Todas" || lead.priority === priority) &&
        (temperature === "Todas" || lead.temperature === temperature) &&
        (tag === "Todas" || lead.tags.includes(tag)) &&
        (special !== "overdue_task" || overdueLeadIds.has(lead.id)) &&
        (special !== "unread_conversation" || unreadLeadIds.has(lead.id)) &&
        (special !== "invalid_owner" || !canUserOwnLead(users.find((user) => user.id === lead.ownerId), lead.pipelineId)) &&
        (special !== "without_next_task" || (openStageIds.has(lead.stageId) && !pendingTaskLeadIds.has(lead.id))) &&
        (special !== "open_lead" || openStageIds.has(lead.stageId)) &&
        (special !== "won_lead" || wonStageIds.has(lead.stageId)) &&
        (!dateFrom || lead.createdAt.slice(0, 10) >= dateFrom) &&
        (!dateTo || lead.createdAt.slice(0, 10) <= dateTo)
      );
    });
  }, [
    visibleLeads,
    activeLeadFields,
    search,
    pipeline,
    stage,
    owner,
    origin,
    priority,
    temperature,
    tag,
    dateFrom,
    dateTo,
    special,
    overdueLeadIds,
    unreadLeadIds,
    pendingTaskLeadIds,
    openStageIds,
    wonStageIds,
    users,
  ]);

  const activeFilters = [
    search && { key: "search", label: `Busca: ${search}`, clear: () => setSearch("") },
    pipeline !== "Todos" && { key: "pipeline", label: `Funil: ${pipelines.find((item) => item.id === pipeline)?.name || pipeline}`, clear: () => { setPipeline("Todos"); setStage("Todas"); } },
    stage !== "Todas" && { key: "stage", label: `Etapa: ${stages.find((item) => item.id === stage)?.name || stage}`, clear: () => setStage("Todas") },
    owner !== "Todos" && { key: "owner", label: `Responsável: ${users.find((item) => item.id === owner)?.name || owner}`, clear: () => setOwner("Todos") },
    origin !== "Todas" && { key: "origin", label: `${fieldLabel("origin")}: ${origin}`, clear: () => setOrigin("Todas") },
    priority !== "Todas" && { key: "priority", label: `${fieldLabel("priority")}: ${priority}`, clear: () => setPriority("Todas") },
    temperature !== "Todas" && { key: "temperature", label: `${fieldLabel("temperature")}: ${temperature}`, clear: () => setTemperature("Todas") },
    tag !== "Todas" && { key: "tag", label: `Etiqueta: ${tag}`, clear: () => setTag("Todas") },
    (dateFrom || dateTo) && { key: "date", label: `Entrada: ${dateFrom || "início"} até ${dateTo || "hoje"}`, clear: () => { setDateFrom(""); setDateTo(""); } },
    special && { key: "special", label: specialLabel || ({ overdue_task: "Tarefas atrasadas", unread_conversation: "Conversas não lidas", invalid_owner: "Responsabilidade inconsistente", without_next_task: "Sem próxima tarefa", open_lead: "Oportunidades abertas", won_lead: "Negócios ganhos" }[special]), clear: () => { setSpecial(""); setSpecialLabel(""); } },
  ].filter(Boolean) as Array<{ key: string; label: string; clear(): void }>;

  const clearFilters = () => {
    setSearch(""); setPipeline("Todos"); setStage("Todas"); setOwner("Todos"); setOrigin("Todas");
    setPriority("Todas"); setTemperature("Todas"); setTag("Todas"); setDateFrom(""); setDateTo(""); setSpecial(""); setSpecialLabel("");
  };

  const exportData = () =>
    downloadCsv(
      `leads-${organization?.slug || "crm"}.csv`,
      filtered.map((lead) => ({
        ...Object.fromEntries(
          activeLeadFields.map((field) => [
            field.label,
            standardFieldExportValue(lead, field),
          ]),
        ),
        Funil: pipelines.find((item) => item.id === lead.pipelineId)?.name,
        Etapa: stages.find((item) => item.id === lead.stageId)?.name,
        Responsável: users.find((item) => item.id === lead.ownerId)?.name,
        Etiquetas: lead.tags.join("; "),
        ...Object.fromEntries(customFields.map((field) => [field.name, lead.customValues?.[field.key] ?? ""])),
      })),
    );

  const visibleTableLeadFields = tableLeadFields.filter(
    (field) => standardVisible[field.key] !== false,
  );
  const visibleTableCustomFields = tableCustomFields.filter(
    (field) => customVisible[field.id] !== false,
  );

  return (
    <div className="leads-page">
      <section className="panel leads-filter-panel">
        <div className="leads-filter-primary">
          <div className="search-control grow">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nos campos principais do lead" />
          </div>
          <SelectControl
            value={pipeline}
            onChange={(value) => { setPipeline(value); setStage("Todas"); }}
            options={["Todos", ...pipelines.map((item) => item.id)]}
            labels={{ Todos: "Todos os funis", ...Object.fromEntries(pipelines.map((item) => [item.id, item.name])) }}
            icon={KanbanSquare}
          />
          <SelectControl
            value={stage}
            onChange={setStage}
            options={["Todas", ...stages.filter((item) => pipeline === "Todos" || item.pipelineId === pipeline).map((item) => item.id)]}
            labels={{ Todas: "Todas as etapas", ...Object.fromEntries(stages.map((item) => [item.id, item.name])) }}
            icon={KanbanSquare}
          />
          <SelectControl
            value={owner}
            onChange={setOwner}
            options={["Todos", ...availableOwners.map((item) => item.id)]}
            labels={{ Todos: "Todos os responsáveis", ...Object.fromEntries(availableOwners.map((item) => [item.id, item.name])) }}
            icon={Users}
          />
          <button type="button" className={`secondary-button filter-toggle${advancedOpen ? " active" : ""}`} onClick={() => setAdvancedOpen((value) => !value)}>
            <Filter size={17} /> Mais filtros {activeFilters.length > 0 && <b>{activeFilters.length}</b>}
          </button>
        </div>

        {advancedOpen && (
          <div className="leads-filter-advanced">
            {fieldIsActive("origin") && <SelectControl value={origin} onChange={setOrigin} options={["Todas", ...origins]} labels={{ Todas: `Todos os valores de ${fieldLabel("origin")}` }} icon={Filter} />}
            {fieldIsActive("priority") && <SelectControl value={priority} onChange={setPriority} options={["Todas", "Urgente", "Alta", "Média", "Baixa"]} labels={{ Todas: `Todos os valores de ${fieldLabel("priority")}` }} icon={AlertCircle} />}
            {fieldIsActive("temperature") && <SelectControl value={temperature} onChange={(value) => setTemperature(value as LeadTemperature | "Todas")} options={["Todas", "Quente", "Morno", "Frio"]} labels={{ Todas: `Todos os valores de ${fieldLabel("temperature")}` }} icon={AlertCircle} />}
            <SelectControl value={tag} onChange={setTag} options={["Todas", ...tags.map((item) => item.name)]} labels={{ Todas: "Todas as etiquetas" }} icon={Tag} />
            <label className="date-filter-control">
              <CalendarRange size={16} />
              <span>Entrada</span>
              <input type="date" aria-label="Data inicial" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
              <i>até</i>
              <input type="date" aria-label="Data final" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
        )}

        <div className="leads-filter-footer">
          <div className="filter-chip-list">
            {activeFilters.length ? activeFilters.map((filter) => (
              <button type="button" className="filter-chip" key={filter.key} onClick={filter.clear} title="Remover filtro">
                {filter.label} <X size={13} />
              </button>
            )) : <span className="filter-summary">Exibindo toda a base dentro do seu escopo de acesso.</span>}
          </div>
          <div className="toolbar-right">
            {activeFilters.length > 0 && <button className="text-button" onClick={clearFilters}>Limpar filtros</button>}
            <button className="secondary-button" onClick={exportData} disabled={!filtered.length}><Download size={17} /> Exportar</button>
            <div className="column-picker-wrap">
              <button className="secondary-button" onClick={() => setColumnsOpen((value) => !value)}><Columns3 size={17} /> Colunas</button>
              {columnsOpen && (
                <div className="popover column-picker">
                  <div className="popover-head"><div><strong>Colunas visíveis</strong><span>Respeita a configuração da empresa e personaliza sua visualização.</span></div></div>
                  <label>
                    <input type="checkbox" checked disabled />
                    {nameField.label}
                  </label>
                  {tableLeadFields.map((field) => (
                    <label key={field.id}>
                      <input
                        type="checkbox"
                        checked={standardVisible[field.key] !== false}
                        onChange={() => setStandardVisible((old) => ({ ...old, [field.key]: old[field.key] === false }))}
                      />
                      {field.label}
                    </label>
                  ))}
                  {(Object.entries(operationalVisible) as Array<[OperationalColumnKey, boolean]>).map(([key, value]) => (
                    <label key={key}>
                      <input type="checkbox" checked={value} onChange={() => setOperationalVisible((old) => ({ ...old, [key]: !old[key] }))} />
                      {operationalColumnLabels[key]}
                    </label>
                  ))}
                  {tableCustomFields.map((field) => (
                    <label key={field.id}>
                      <input type="checkbox" checked={customVisible[field.id] !== false} onChange={() => setCustomVisible((old) => ({ ...old, [field.id]: old[field.id] === false }))} />
                      {field.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {can("leads.create") && <button className="primary-button" onClick={onAdd}><Plus size={17} /> Novo lead</button>}
          </div>
        </div>
      </section>

      <section className="panel leads-table-panel">
        <div className="table-summary">
          <div><strong>{filtered.length}</strong><span>{filtered.length === 1 ? "lead encontrado" : "leads encontrados"}</span></div>
          <span>{activeFilters.length ? `${activeFilters.length} filtros ativos` : "Base completa"}</span>
        </div>

        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>{nameField.label}</th>
                {visibleTableLeadFields.map((field) => <th key={field.id}>{field.label}</th>)}
                {operationalVisible.stage && <th>Etapa</th>}
                {operationalVisible.owner && <th>Responsável</th>}
                {operationalVisible.lastContact && <th>Última interação</th>}
                {visibleTableCustomFields.map((field) => <th key={field.id}>{field.name}</th>)}
                <th><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const ownerUser = users.find((item) => item.id === lead.ownerId);
                const stageItem = stages.find((item) => item.id === lead.stageId);
                const pipelineItem = pipelines.find((item) => item.id === lead.pipelineId);
                const ownerHasAccess = canUserOwnLead(ownerUser, lead.pipelineId);
                return (
                  <tr key={lead.id} role="button" aria-label={`Abrir detalhes de ${lead.name}`} onClick={() => onLead(lead.id)} tabIndex={0} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onLead(lead.id)}>
                    <td>
                      <div className="lead-table-main">
                        <span className="lead-avatar">{lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                        <div><strong>{lead.name}</strong></div>
                      </div>
                    </td>
                    {visibleTableLeadFields.map((field) => (
                      <td key={field.id}>{renderStandardFieldCell(lead, field)}</td>
                    ))}
                    {operationalVisible.stage && (
                      <td>
                        <span className="stage-table" style={{ "--stage-color": stageItem?.color || "#94a3b8" } as React.CSSProperties}><i />{stageItem?.name || "Sem etapa"}</span>
                        <span className="cell-subtitle">{pipelineItem?.name || "Funil não identificado"}</span>
                      </td>
                    )}
                    {operationalVisible.owner && (
                      <td>
                        <div className={`owner-cell${ownerHasAccess ? "" : " invalid"}`} title={ownerHasAccess ? ownerUser?.roleLabel : "Responsável sem acesso ao funil atual"}>
                          <Avatar user={ownerUser} small />
                          <span><strong>{ownerUser?.name || "Não atribuído"}</strong><small>{ownerUser?.roleLabel || "Defina um responsável"}</small></span>
                          {!ownerHasAccess && <AlertCircle size={15} />}
                        </div>
                      </td>
                    )}
                    {operationalVisible.lastContact && <td><strong>{lead.lastContact || "Sem contato"}</strong><span className="cell-subtitle">Atualizado {formatDateTime(lead.updatedAt)}</span></td>}
                    {visibleTableCustomFields.map((field) => (
                      <td key={field.id}>{customFieldValue(field, lead)}</td>
                    ))}
                    <td><span className="row-open-icon"><ChevronRight size={17} /></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="empty-table"><Search size={20} /> Nenhum lead corresponde aos filtros atuais.</div>}
        </div>
      </section>
    </div>
  );
}
