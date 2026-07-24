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
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, OriginBadge, PriorityBadge, SelectControl } from "../components/Common";
import { canUserOwnLead } from "../core/crmConsistency";
import type { LeadListPreset, LeadSpecialFilter } from "../core/leadFilters";
import type { LeadTemperature } from "../core/types";
import { currency, downloadCsv, formatDateTime } from "../core/utils";

const COLUMNS_KEY = "crm-product-leads-columns-v2";
const CUSTOM_COLUMNS_KEY = "crm-product-leads-custom-columns-v2";
type VisibleColumns = {
  contact: boolean;
  city: boolean;
  origin: boolean;
  stage: boolean;
  priority: boolean;
  owner: boolean;
  value: boolean;
  lastContact: boolean;
};

const defaultColumns: VisibleColumns = {
  contact: true,
  city: true,
  origin: true,
  stage: true,
  priority: true,
  owner: true,
  value: true,
  lastContact: true,
};

interface LeadsPageProps {
  onLead(id: string): void;
  onAdd(): void;
  initialSearch?: string;
  preset?: LeadListPreset | null;
  onSearchApplied?(): void;
}

export function LeadsPage({ onLead, onAdd, initialSearch = "", preset, onSearchApplied }: LeadsPageProps) {
  const { data, visibleLeads, can } = useCrm();
  const pipelines = (data?.pipelines || []).filter((item) => item.active);
  const stages = [...(data?.stages || [])].sort((a, b) => a.order - b.order);
  const users = (data?.users || []).filter((user) => user.active);
  const tags = data?.tags || [];
  const organization = data?.organizations.find((item) => item.id === data.session?.organizationId);
  const customFields = (data?.customFields || []).filter((field) => field.active);

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
  const [visible, setVisible] = useState<VisibleColumns>(() => {
    try {
      const saved = localStorage.getItem(COLUMNS_KEY);
      return saved ? { ...defaultColumns, ...(JSON.parse(saved) as Partial<VisibleColumns>) } : { ...defaultColumns };
    } catch {
      return { ...defaultColumns };
    }
  });
  const [customVisible, setCustomVisible] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_COLUMNS_KEY) || "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });

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
  useEffect(() => localStorage.setItem(COLUMNS_KEY, JSON.stringify(visible)), [visible]);
  useEffect(() => {
    setCustomVisible((old) => {
      const next = { ...old };
      customFields.forEach((field) => {
        if (next[field.id] === undefined) next[field.id] = field.showInTable;
      });
      return next;
    });
  }, [data?.customFields]);
  useEffect(() => localStorage.setItem(CUSTOM_COLUMNS_KEY, JSON.stringify(customVisible)), [customVisible]);

  const origins = useMemo(() => Array.from(new Set(visibleLeads.map((lead) => lead.origin))).sort(), [visibleLeads]);
  const availableOwners = useMemo(
    () =>
      users.filter((user) => pipeline === "Todos" || canUserOwnLead(user, pipeline)),
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
      const searchable = `${lead.name} ${lead.company} ${lead.phone} ${lead.email} ${lead.city}`.toLowerCase();
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
    origin !== "Todas" && { key: "origin", label: `Origem: ${origin}`, clear: () => setOrigin("Todas") },
    priority !== "Todas" && { key: "priority", label: `Prioridade: ${priority}`, clear: () => setPriority("Todas") },
    temperature !== "Todas" && { key: "temperature", label: `Temperatura: ${temperature}`, clear: () => setTemperature("Todas") },
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
        Nome: lead.name,
        Empresa: lead.company,
        Telefone: lead.phone,
        Email: lead.email,
        Cidade: lead.city,
        Origem: lead.origin,
        Campanha: lead.campaign,
        Funil: pipelines.find((item) => item.id === lead.pipelineId)?.name,
        Etapa: stages.find((item) => item.id === lead.stageId)?.name,
        Responsável: users.find((item) => item.id === lead.ownerId)?.name,
        Prioridade: lead.priority,
        Temperatura: lead.temperature,
        Score: lead.score,
        Valor: lead.value,
        Tags: lead.tags.join("; "),
        ...Object.fromEntries(customFields.map((field) => [field.name, lead.customValues?.[field.key] ?? ""])),
      })),
    );

  return (
    <div className="leads-page">
      <section className="panel leads-filter-panel">
        <div className="leads-filter-primary">
          <div className="search-control grow">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, empresa, telefone ou e-mail" />
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
            <SelectControl value={origin} onChange={setOrigin} options={["Todas", ...origins]} labels={{ Todas: "Todas as origens" }} icon={Filter} />
            <SelectControl value={priority} onChange={setPriority} options={["Todas", "Urgente", "Alta", "Média", "Baixa"]} labels={{ Todas: "Todas as prioridades" }} icon={AlertCircle} />
            <SelectControl value={temperature} onChange={(value) => setTemperature(value as LeadTemperature | "Todas")} options={["Todas", "Quente", "Morno", "Frio"]} labels={{ Todas: "Todas as temperaturas" }} icon={AlertCircle} />
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
                  <div className="popover-head"><div><strong>Colunas visíveis</strong><span>Personalize apenas esta visualização.</span></div></div>
                  {(Object.entries(visible) as Array<[keyof VisibleColumns, boolean]>).map(([key, value]) => (
                    <label key={key}>
                      <input type="checkbox" checked={value} onChange={() => setVisible((old) => ({ ...old, [key]: !old[key] }))} />
                      {{ contact: "Contato", city: "Cidade", origin: "Origem", stage: "Etapa", priority: "Prioridade", owner: "Responsável", value: "Valor", lastContact: "Última interação" }[key]}
                    </label>
                  ))}
                  {customFields.map((field) => (
                    <label key={field.id}>
                      <input type="checkbox" checked={Boolean(customVisible[field.id])} onChange={() => setCustomVisible((old) => ({ ...old, [field.id]: !old[field.id] }))} />
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
                <th>Lead</th>
                {visible.contact && <th>Contato</th>}
                {visible.city && <th>Cidade</th>}
                {visible.origin && <th>Origem</th>}
                {visible.stage && <th>Etapa</th>}
                {visible.priority && <th>Prioridade</th>}
                {visible.owner && <th>Responsável</th>}
                {visible.value && <th>Valor</th>}
                {visible.lastContact && <th>Última interação</th>}
                {customFields.filter((field) => customVisible[field.id]).map((field) => <th key={field.id}>{field.name}</th>)}
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
                        <div><strong>{lead.name}</strong><span>{lead.company || "Sem empresa"}</span></div>
                      </div>
                    </td>
                    {visible.contact && <td><strong>{lead.phone || "Sem telefone"}</strong><span className="cell-subtitle">{lead.email || "Sem e-mail"}</span></td>}
                    {visible.city && <td>{lead.city || "—"}</td>}
                    {visible.origin && <td><OriginBadge origin={lead.origin} /></td>}
                    {visible.stage && (
                      <td>
                        <span className="stage-table" style={{ "--stage-color": stageItem?.color || "#94a3b8" } as React.CSSProperties}><i />{stageItem?.name || "Sem etapa"}</span>
                        <span className="cell-subtitle">{pipelineItem?.name || "Funil não identificado"}</span>
                      </td>
                    )}
                    {visible.priority && <td><PriorityBadge value={lead.priority} /></td>}
                    {visible.owner && (
                      <td>
                        <div className={`owner-cell${ownerHasAccess ? "" : " invalid"}`} title={ownerHasAccess ? ownerUser?.roleLabel : "Responsável sem acesso ao funil atual"}>
                          <Avatar user={ownerUser} small />
                          <span><strong>{ownerUser?.name || "Não atribuído"}</strong><small>{ownerUser?.roleLabel || "Defina um responsável"}</small></span>
                          {!ownerHasAccess && <AlertCircle size={15} />}
                        </div>
                      </td>
                    )}
                    {visible.value && <td><strong>{currency(lead.value)}</strong></td>}
                    {visible.lastContact && <td><strong>{lead.lastContact || "Sem contato"}</strong><span className="cell-subtitle">Atualizado {formatDateTime(lead.updatedAt)}</span></td>}
                    {customFields.filter((field) => customVisible[field.id]).map((field) => {
                      const value = lead.customValues?.[field.key];
                      return <td key={field.id}>{typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value ?? "—")}</td>;
                    })}
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
