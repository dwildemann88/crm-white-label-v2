import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  Gauge,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Tag,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { canUserOwnLead } from "../core/crmConsistency";
import type { CustomFieldDefinition, Lead, TagDefinition } from "../core/types";
import { currency, formatDateTime, uid } from "../core/utils";
import { Avatar, OriginBadge, PriorityBadge, TagSelector } from "./Common";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="info-row">
      <span className="info-row-icon"><Icon size={16} /></span>
      <div>
        <small>{label}</small>
        <strong>{value || "Não informado"}</strong>
      </div>
    </div>
  );
}

function formatCustomValue(field: CustomFieldDefinition, value: unknown) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === null || value === undefined || value === "") return "Não informado";
  if (
    typeof value === "number" &&
    /(valor|fatura|conta|orçamento|orcamento|receita|custo)/i.test(`${field.name} ${field.key}`)
  ) {
    return currency(value);
  }
  if (field.type === "date") {
    try {
      return new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(value)}T12:00:00`));
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function LeadDrawer({
  lead,
  onClose,
  onEdit,
  onTask,
  onWhatsApp,
}: {
  lead: Lead;
  onClose(): void;
  onEdit(): void;
  onTask(): void;
  onWhatsApp(): void;
}) {
  const { data, addLeadNote, saveLead, saveTag, can } = useCrm();
  const [note, setNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2563eb");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const owner = data?.users.find((item) => item.id === lead.ownerId);
  const pipeline = data?.pipelines.find((item) => item.id === lead.pipelineId);
  const stage = data?.stages.find((item) => item.id === lead.stageId);
  const ownerHasPipelineAccess = canUserOwnLead(owner, lead.pipelineId);
  const allTags = (data?.tags || []).map((item) => item.name);
  const tagColors = Object.fromEntries((data?.tags || []).map((item) => [item.name, item.color]));
  const customFields = (data?.customFields || []).filter(
    (field) => field.active && lead.customValues?.[field.key] !== undefined,
  );
  const history = useMemo(
    () =>
      (data?.histories || [])
        .filter((item) => item.leadId === lead.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12),
    [data?.histories, lead.id],
  );
  const existingConversation = data?.conversations.find(
    (conversation) => conversation.leadId === lead.id && conversation.channel === "whatsapp",
  );

  const toggleTags = async (tags: string[]) => saveLead({ ...lead, tags });

  const createTag = async () => {
    const name = newTag.trim();
    if (!name || !data?.session) return;
    const tag: TagDefinition = {
      id: uid("tag"),
      organizationId: data.session.organizationId,
      name,
      color: newTagColor,
    };
    await saveTag(tag);
    await toggleTags(Array.from(new Set([...lead.tags, name])));
    setNewTag("");
  };

  return (
    <>
      <button className="drawer-overlay" onClick={onClose} aria-label="Fechar detalhes" />
      <aside className="lead-drawer" role="dialog" aria-modal="true" aria-label={`Detalhes de ${lead.name}`}>
        <header className="lead-drawer-header">
          <div className="lead-drawer-identity">
            <span className="lead-avatar large">
              {lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
            </span>
            <div>
              <div className="lead-drawer-kicker">
                <span className={`temperature-badge temperature-${lead.temperature.toLowerCase()}`}>{lead.temperature}</span>
                <span>{pipeline?.name || "Funil não identificado"}</span>
              </div>
              <h2>{lead.name}</h2>
              <p>{lead.company || "Sem empresa informada"}</p>
            </div>
          </div>
          <button className="icon-button subtle" onClick={onClose} aria-label="Fechar painel">
            <X size={19} />
          </button>
        </header>

        <div className="drawer-actions">
          {can("messages.manage") && (
            <button
              className="primary-button"
              onClick={onWhatsApp}
              disabled={!lead.phone.trim()}
              title={lead.phone.trim() ? undefined : "Cadastre um telefone antes de iniciar o WhatsApp"}
            >
              <MessageCircle size={17} />
              {existingConversation ? "Abrir conversa" : "Iniciar conversa"}
            </button>
          )}
          {can("tasks.manage") && (
            <button className="secondary-button" onClick={onTask}>
              <CalendarDays size={17} /> Criar tarefa
            </button>
          )}
          {can("leads.write") && (
            <button className="secondary-button" onClick={onEdit}>
              <Edit3 size={17} /> Editar
            </button>
          )}
        </div>

        <div className="drawer-body">
          <section className="drawer-summary">
            <div>
              <small>Valor estimado</small>
              <strong>{currency(lead.value)}</strong>
            </div>
            <div>
              <small>Score comercial</small>
              <strong>{lead.score}<span>/100</span></strong>
            </div>
            <div>
              <small>Prioridade</small>
              <PriorityBadge value={lead.priority} />
            </div>
          </section>

          <section className="drawer-section commercial-context">
            <div className="section-title-row">
              <div><h3>Contexto comercial</h3><p>Responsável, funil e etapa atual do lead.</p></div>
            </div>
            <div className="commercial-context-grid">
              <div className="context-owner">
                <Avatar user={owner} />
                <div>
                  <small>Responsável comercial</small>
                  <strong>{owner?.name || "Não atribuído"}</strong>
                  <span>{owner?.roleLabel || "Defina um responsável"}</span>
                </div>
              </div>
              <div className="context-stage">
                <small>Etapa atual</small>
                <span className="stage-pill" style={{ "--stage-color": stage?.color || "#94a3b8" } as React.CSSProperties}>
                  <i /> {stage?.name || "Etapa não identificada"}
                </span>
                <em>{pipeline?.name || "Funil não identificado"}</em>
              </div>
            </div>
            {owner && !ownerHasPipelineAccess && (
              <div className="inline-alert warning actionable">
                <AlertTriangle size={16} />
                <span>O responsável atual não possui acesso a este funil. Selecione um responsável compatível antes de continuar a operação.</span>
                {can("leads.write") && <button type="button" onClick={onEdit}>Corrigir responsável</button>}
              </div>
            )}
          </section>

          <section className="drawer-section info-grid">
            <InfoRow icon={Phone} label="Telefone" value={lead.phone} />
            <InfoRow icon={Mail} label="E-mail" value={lead.email} />
            <InfoRow icon={MapPin} label="Cidade" value={lead.city} />
            <InfoRow icon={BriefcaseBusiness} label="Empresa" value={lead.company} />
            <InfoRow icon={Gauge} label="Campanha" value={lead.campaign} />
            <InfoRow icon={Clock3} label="Última atualização" value={formatDateTime(lead.updatedAt)} />
          </section>

          {customFields.length > 0 && (
            <section className="drawer-section">
              <div className="section-title-row">
                <div><h3>Campos personalizados</h3><p>Informações específicas coletadas para esta oportunidade.</p></div>
              </div>
              <dl className="custom-value-grid">
                {customFields.map((field) => (
                  <div key={field.id}>
                    <dt>{field.name}</dt>
                    <dd>{formatCustomValue(field, lead.customValues?.[field.key])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="drawer-section">
            <div className="section-title-row">
              <div><h3>Origem e etiquetas</h3><p>Classifique o lead sem misturar origem de aquisição com segmentação.</p></div>
            </div>
            <div className="lead-origin-block">
              <small>Origem</small>
              <OriginBadge origin={lead.origin} />
              {lead.campaign && <span>{lead.campaign}</span>}
            </div>
            <div className="lead-tags-block">
              <small>Etiquetas</small>
              <TagSelector available={allTags} value={lead.tags} onChange={toggleTags} colors={tagColors} disabled={!can("leads.write")} />
            </div>
            {can("tags.manage") && (
              <details className="quick-tag-details">
                <summary><Plus size={15} /> Criar nova etiqueta</summary>
                <div className="quick-tag-form">
                  <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Nome da etiqueta" />
                  <label className="color-control">
                    <span>Cor</span>
                    <input type="color" value={newTagColor} onChange={(event) => setNewTagColor(event.target.value)} aria-label="Cor da etiqueta" />
                  </label>
                  <button className="secondary-button" disabled={!newTag.trim()} onClick={() => void createTag()}>
                    <Plus size={15} /> Criar
                  </button>
                </div>
              </details>
            )}
          </section>

          <section className="drawer-section">
            <div className="section-title-row">
              <div><h3>Observações</h3><p>Contexto comercial registrado pela equipe.</p></div>
            </div>
            <div className="notes-box">
              {lead.notes ? lead.notes.split("\n").map((line, index) => <p key={index}>{line || <br />}</p>) : <p className="muted">Nenhuma observação registrada.</p>}
            </div>
            {can("leads.write") && (
              <div className="note-composer">
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Adicione uma observação objetiva para o histórico do lead" />
                <div>
                  <span>{note.trim().length ? `${note.trim().length} caracteres` : "A observação ficará registrada na linha do tempo."}</span>
                  <button
                    className="primary-button compact"
                    disabled={!note.trim()}
                    onClick={async () => {
                      await addLeadNote(lead.id, note);
                      setNote("");
                    }}
                  >
                    <Check size={16} /> Registrar
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="drawer-section timeline">
            <div className="section-title-row">
              <div><h3>Histórico recente</h3><p>Alterações e interações mais recentes desta oportunidade.</p></div>
            </div>
            {history.length ? history.map((item) => (
              <div className="timeline-item" key={item.id}>
                <span className="timeline-icon">
                  {item.type === "message" ? <MessageCircle size={14} /> : item.type === "assigned" ? <UserCog size={14} /> : <Tag size={14} />}
                </span>
                <p><strong>{item.description}</strong><small>{formatDateTime(item.createdAt)}</small></p>
              </div>
            )) : <p className="muted">Nenhum evento registrado.</p>}
          </section>
        </div>
      </aside>
    </>
  );
}
