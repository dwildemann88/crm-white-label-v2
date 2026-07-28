import {
  AlertCircle,
  AlertTriangle,
  Filter,
  GripVertical,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, OriginBadge, PriorityBadge, SelectControl } from "../components/Common";
import { canUserOwnLead } from "../core/crmConsistency";
import { resolveLeadFields } from "../core/leadFields";
import type { Lead, LeadFieldDefinition, LeadFieldKey } from "../core/types";
import { currency } from "../core/utils";

function LeadCard({ lead, leadFields, onOpen, onDrag, onDragEnd, draggable }: {
  lead: Lead;
  leadFields: LeadFieldDefinition[];
  onOpen(): void;
  onDrag(): void;
  onDragEnd(): void;
  draggable: boolean;
}) {
  const { data } = useCrm();
  const didDrag = useRef(false);
  const owner = data?.users.find((user) => user.id === lead.ownerId);
  const ownerConsistent = canUserOwnLead(owner, lead.pipelineId);
  const tagColors = Object.fromEntries((data?.tags || []).map((tag) => [tag.name, tag.color]));
  const fieldMap = new Map(leadFields.map((field) => [field.key, field]));
  const activeField = (key: LeadFieldKey) => fieldMap.get(key)?.active === true;
  const fieldLabel = (key: LeadFieldKey) => fieldMap.get(key)?.label || key;
  const showInfo = activeField("phone") || activeField("score");
  const showCommercialSummary = activeField("priority") || activeField("value");

  return (
    <article
      className={`lead-card${draggable ? "" : " read-only"}${ownerConsistent ? "" : " inconsistent"}`}
      draggable={draggable}
      onDragStart={() => { didDrag.current = true; onDrag(); }}
      onDragEnd={() => { onDragEnd(); window.setTimeout(() => { didDrag.current = false; }, 0); }}
      onClick={() => { if (!didDrag.current) onOpen(); }}
      tabIndex={0}
      onKeyDown={(event) => event.key === "Enter" && onOpen()}
    >
      <div className="lead-card-top">
        {activeField("origin") && lead.origin && <OriginBadge origin={lead.origin} />}
        {draggable && <GripVertical className="lead-drag-handle" size={16} aria-hidden="true" />}
      </div>
      <div className="lead-card-title">
        <strong>{lead.name}</strong>
        {activeField("company") && (
          <span>{lead.company || `${fieldLabel("company")} não informado`}</span>
        )}
      </div>
      <div className="lead-card-tags">
        {lead.tags.slice(0, 2).map((tag) => <span key={tag} style={{ "--tag-color": tagColors[tag] || "#94a3b8" } as React.CSSProperties}>{tag}</span>)}
        {lead.tags.length > 2 && <span className="tag-overflow">+{lead.tags.length - 2}</span>}
      </div>
      {showInfo && (
        <div className="lead-card-info">
          {activeField("phone") && <span><Phone size={13} />{lead.phone || `${fieldLabel("phone")} não informado`}</span>}
          {activeField("score") && <span><Target size={13} />{fieldLabel("score")} {lead.score}</span>}
        </div>
      )}
      {!ownerConsistent && <div className="lead-card-warning"><AlertTriangle size={14} />Responsável sem acesso ao funil</div>}
      <div className="lead-card-footer">
        {showCommercialSummary ? (
          <div>
            {activeField("priority") && <PriorityBadge value={lead.priority} />}
            {activeField("value") && <strong>{currency(lead.value)}</strong>}
          </div>
        ) : <span />}
        <span className="lead-card-owner" title={owner?.name}><Avatar user={owner} small /><small>{owner?.name || "Não atribuído"}</small></span>
      </div>
    </article>
  );
}

export function KanbanPage({ onLead, onAdd, onEditStages, initialPipelineId }: {
  onLead(id: string): void;
  onAdd(): void;
  onEditStages(pipelineId: string): void;
  initialPipelineId?: string;
}) {
  const { data, visibleLeads, moveLead, can } = useCrm();
  const organizationId = data?.session?.organizationId || "sem-organizacao";
  const leadFields = useMemo(
    () => resolveLeadFields(data?.leadFields || [], organizationId),
    [data?.leadFields, organizationId],
  );
  const fieldMap = useMemo(
    () => new Map(leadFields.map((field) => [field.key, field])),
    [leadFields],
  );
  const activeField = (key: LeadFieldKey) => fieldMap.get(key)?.active === true;
  const fieldLabel = (key: LeadFieldKey) => fieldMap.get(key)?.label || key;
  const searchableFields = leadFields.filter(
    (field) => field.active && ["name", "company", "phone", "email", "city", "origin", "campaign", "notes"].includes(field.key),
  );
  const searchPlaceholder = `Buscar ${searchableFields.slice(0, 4).map((field) => field.label.toLowerCase()).join(", ") || "lead"}`;

  const pipelines = (data?.pipelines || []).filter((item) => item.active);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id || "");
  const stages = [...(data?.stages || [])].filter((stage) => stage.pipelineId === pipelineId).sort((a, b) => a.order - b.order);
  const users = (data?.users || []).filter((user) => user.active && canUserOwnLead(user, pipelineId));
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("Todos");
  const [priority, setPriority] = useState("Todas");
  const [origin, setOrigin] = useState("Todas");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    if (initialPipelineId && pipelines.some((item) => item.id === initialPipelineId)) {
      setPipelineId(initialPipelineId);
      return;
    }
    if (pipelineId && pipelines.some((item) => item.id === pipelineId)) return;
    setPipelineId(pipelines[0]?.id || "");
  }, [initialPipelineId, pipelineId, pipelines]);

  useEffect(() => {
    if (owner === "Todos" || users.some((user) => user.id === owner)) return;
    setOwner("Todos");
  }, [owner, users]);

  useEffect(() => {
    if (!activeField("priority") && priority !== "Todas") setPriority("Todas");
    if (!activeField("origin") && origin !== "Todas") setOrigin("Todas");
  }, [fieldMap, origin, priority]);

  const origins = useMemo(
    () => activeField("origin")
      ? Array.from(new Set(visibleLeads.filter((lead) => lead.pipelineId === pipelineId).map((lead) => lead.origin).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"))
      : [],
    [visibleLeads, pipelineId, fieldMap],
  );

  const filtered = useMemo(() => visibleLeads.filter((lead) => {
    const query = search.trim().toLowerCase();
    const searchText = searchableFields
      .map((field) => String(lead[field.key] ?? ""))
      .join(" ")
      .toLowerCase();
    return lead.pipelineId === pipelineId &&
      (!query || searchText.includes(query)) &&
      (owner === "Todos" || lead.ownerId === owner) &&
      (!activeField("priority") || priority === "Todas" || lead.priority === priority) &&
      (!activeField("origin") || origin === "Todas" || lead.origin === origin);
  }), [visibleLeads, search, owner, priority, origin, pipelineId, searchableFields, fieldMap]);

  const activeFilters = [
    search,
    owner !== "Todos",
    activeField("priority") && priority !== "Todas",
    activeField("origin") && origin !== "Todas",
  ].filter(Boolean).length;
  const totalValue = filtered.reduce((sum, lead) => sum + lead.value, 0);

  const clearFilters = () => { setSearch(""); setOwner("Todos"); setPriority("Todas"); setOrigin("Todas"); };

  return (
    <div className="kanban-page">
      <section className="panel kanban-toolbar">
        <div className="kanban-toolbar-main">
          <div className="search-control grow"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} /></div>
          <SelectControl value={pipelineId} onChange={(value) => { setPipelineId(value); setOwner("Todos"); }} options={pipelines.map((pipeline) => pipeline.id)} labels={Object.fromEntries(pipelines.map((pipeline) => [pipeline.id, pipeline.name]))} icon={SlidersHorizontal} />
          <SelectControl value={owner} onChange={setOwner} options={["Todos", ...users.map((user) => user.id)]} labels={{ Todos: "Todos os responsáveis", ...Object.fromEntries(users.map((user) => [user.id, user.name])) }} icon={Users} />
          {activeField("priority") && <SelectControl value={priority} onChange={setPriority} options={["Todas", "Urgente", "Alta", "Média", "Baixa"]} labels={{ Todas: `Todas: ${fieldLabel("priority")}` }} icon={AlertCircle} />}
          {activeField("origin") && <SelectControl value={origin} onChange={setOrigin} options={["Todas", ...origins]} labels={{ Todas: `Todas: ${fieldLabel("origin")}` }} icon={Filter} />}
        </div>
        <div className="kanban-toolbar-footer">
          <div className="kanban-summary">
            <span><strong>{filtered.length}</strong> leads visíveis</span>
            {activeField("value") && <span><strong>{currency(totalValue)}</strong> no funil</span>}
            {activeFilters > 0 && <button type="button" onClick={clearFilters}><X size={13} />Limpar {activeFilters} filtros</button>}
          </div>
          <div className="toolbar-right">
            {can("pipeline.manage") && <button className="secondary-button" onClick={() => onEditStages(pipelineId)}><SlidersHorizontal size={17} />Configurar etapas</button>}
            {can("leads.create") && <button className="primary-button" onClick={onAdd}><Plus size={17} />Novo lead</button>}
          </div>
        </div>
      </section>

      {!pipelines.length ? (
        <div className="panel empty-board-state"><strong>Nenhum funil ativo</strong><span>Crie ou ative um funil na Administração para começar a organizar oportunidades.</span></div>
      ) : (
        <div className="kanban-scroll-hint">Arraste os cards entre as etapas. Em telas menores, deslize horizontalmente para navegar pelo funil.</div>
      )}

      {pipelines.length > 0 && (
        <div className="kanban-board" tabIndex={0} aria-label="Quadro Kanban com rolagem horizontal">
          {stages.map((stage) => {
            const list = filtered.filter((lead) => lead.stageId === stage.id);
            const value = list.reduce((sum, lead) => sum + lead.value, 0);
            return (
              <section
                className={`kanban-column${dropTarget === stage.id ? " drop-target" : ""}`}
                key={stage.id}
                onDragOver={(event) => { event.preventDefault(); setDropTarget(stage.id); }}
                onDragLeave={() => setDropTarget((current) => current === stage.id ? null : current)}
                onDrop={async () => {
                  if (dragging && can("pipeline.move")) await moveLead(dragging, stage.id);
                  setDragging(null); setDropTarget(null);
                }}
              >
                <header className="kanban-column-head">
                  <div><span style={{ background: stage.color }} /><strong>{stage.name}</strong><b>{list.length}</b></div>
                  {activeField("value") && <small>{currency(value)}</small>}
                </header>
                <div className="kanban-cards">
                  {list.map((lead) => <LeadCard key={lead.id} lead={lead} leadFields={leadFields} onOpen={() => onLead(lead.id)} onDrag={() => setDragging(lead.id)} onDragEnd={() => { setDragging(null); setDropTarget(null); }} draggable={can("pipeline.move")} />)}
                  {!list.length && <div className="kanban-empty-column"><span style={{ borderColor: stage.color }} /><strong>Etapa vazia</strong><small>Arraste uma oportunidade para cá.</small></div>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
