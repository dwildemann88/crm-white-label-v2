import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Inbox,
  MessageCircle,
  SlidersHorizontal,
  Target,
  TrendingUp,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, OriginBadge, PanelHead, PriorityBadge, SelectControl } from "../components/Common";
import { canUserOwnLead } from "../core/crmConsistency";
import type { LeadListPreset } from "../core/leadFilters";
import { currency, formatDateTime, localDateKey } from "../core/utils";

function KpiCard({ icon: Icon, label, value, detail, tone, onClick }: {
  icon: typeof Inbox;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`kpi-icon tone-${tone}`}><Icon size={20} /></span>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      {onClick && <ArrowRight size={16} />}
    </>
  );
  return onClick ? <button type="button" className="kpi-card interactive" onClick={onClick}>{content}</button> : <article className="kpi-card">{content}</article>;
}

interface DashboardPageProps {
  onNavigate(page: string): void;
  onLead(id: string): void;
  onTask(id: string): void;
  onOpenLeads(preset?: Omit<LeadListPreset, "id">): void;
  onOpenKanban(pipelineId?: string): void;
}

export function DashboardPage({ onNavigate, onLead, onTask, onOpenLeads, onOpenKanban }: DashboardPageProps) {
  const { data, visibleLeads, toggleTask, can } = useCrm();
  const pipelines = (data?.pipelines || []).filter((item) => item.active);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id || "");
  const allStages = [...(data?.stages || [])].sort((a, b) => a.order - b.order);
  const stages = allStages.filter((stage) => stage.pipelineId === pipelineId);
  const funnelLeads = visibleLeads.filter((lead) => lead.pipelineId === pipelineId);
  const users = (data?.users || []).filter((user) => user.active);
  const tasks = data?.tasks || [];
  const conversations = data?.conversations || [];

  useEffect(() => {
    if (pipelineId && pipelines.some((item) => item.id === pipelineId)) return;
    setPipelineId(pipelines[0]?.id || "");
  }, [pipelineId, pipelines]);

  const metrics = useMemo(() => {
    const wonIds = new Set(allStages.filter((stage) => stage.kind === "won").map((stage) => stage.id));
    const lostIds = new Set(allStages.filter((stage) => stage.kind === "lost").map((stage) => stage.id));
    const open = visibleLeads.filter((lead) => !wonIds.has(lead.stageId) && !lostIds.has(lead.stageId));
    const won = visibleLeads.filter((lead) => wonIds.has(lead.stageId));
    const lost = visibleLeads.filter((lead) => lostIds.has(lead.stageId));
    return {
      open,
      won,
      pipeline: open.reduce((sum, lead) => sum + lead.value, 0),
      conversion: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
      hot: open.filter((lead) => lead.temperature === "Quente").length,
    };
  }, [allStages, visibleLeads]);

  const today = localDateKey();
  // O gateway e o RLS já entregam apenas as tarefas visíveis para a sessão atual.
  const scopedTasks = tasks;
  const todayTasks = scopedTasks.filter((task) => task.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const overdueTasks = scopedTasks.filter((task) => {
    if (task.done) return false;
    const scheduled = new Date(`${task.date}T${task.time || "23:59"}:00`).getTime();
    return Number.isFinite(scheduled) && scheduled < Date.now();
  });
  const unreadConversations = conversations.filter((conversation) => conversation.unread > 0 && visibleLeads.some((lead) => lead.id === conversation.leadId));
  const invalidOwners = visibleLeads.filter((lead) => !canUserOwnLead(users.find((user) => user.id === lead.ownerId), lead.pipelineId));

  const stageStats = stages.map((stage) => {
    const leads = funnelLeads.filter((lead) => lead.stageId === stage.id);
    return { stage, leads, value: leads.reduce((sum, lead) => sum + lead.value, 0) };
  });
  const maxStageCount = Math.max(1, ...stageStats.map((item) => item.leads.length));

  const sources = Array.from(new Set(visibleLeads.map((lead) => lead.origin)))
    .map((source) => ({ source, count: visibleLeads.filter((lead) => lead.origin === source).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const sourceTotal = Math.max(1, sources.reduce((sum, item) => sum + item.count, 0));

  return (
    <div className="dashboard-page">
      <section className="kpi-grid">
        <KpiCard icon={Inbox} label="Oportunidades abertas" value={metrics.open.length} detail="Leads ativos no seu escopo" tone="blue" onClick={() => onOpenLeads({ special: "open_lead", label: "Oportunidades abertas" })} />
        <KpiCard icon={CircleDollarSign} label="Pipeline estimado" value={currency(metrics.pipeline)} detail="Valor das oportunidades abertas" tone="indigo" onClick={() => onOpenLeads({ special: "open_lead", label: "Pipeline aberto" })} />
        <KpiCard icon={Target} label="Conversão de fechamentos" value={`${metrics.conversion}%`} detail={`${metrics.won.length} negócios ganhos`} tone="green" onClick={() => onNavigate("analytics")} />
        <KpiCard icon={Zap} label="Leads quentes" value={metrics.hot} detail="Prioridades comerciais abertas" tone="amber" onClick={() => onOpenLeads({ special: "open_lead", temperature: "Quente", label: "Leads quentes" })} />
      </section>

      {(overdueTasks.length > 0 || unreadConversations.length > 0 || invalidOwners.length > 0) && (
        <section className="operation-alerts" aria-label="Pendências operacionais">
          {overdueTasks.length > 0 && <button type="button" onClick={() => onOpenLeads({ special: "overdue_task", label: "Tarefas atrasadas" })}><AlertTriangle size={17} /><span><strong>{overdueTasks.length} tarefas atrasadas</strong><small>Reorganize a agenda da equipe.</small></span><ArrowRight size={16} /></button>}
          {unreadConversations.length > 0 && <button type="button" onClick={() => onOpenLeads({ special: "unread_conversation", label: "Conversas não lidas" })}><MessageCircle size={17} /><span><strong>{unreadConversations.length} conversas não lidas</strong><small>Clientes aguardando atendimento.</small></span><ArrowRight size={16} /></button>}
          {invalidOwners.length > 0 && <button type="button" onClick={() => onOpenLeads({ special: "invalid_owner", label: "Responsabilidades inconsistentes" })}><UserRoundCheck size={17} /><span><strong>{invalidOwners.length} responsabilidades inconsistentes</strong><small>Usuário ausente ou sem acesso ao funil.</small></span><ArrowRight size={16} /></button>}
        </section>
      )}

      <section className="dashboard-main-grid">
        <article className="panel dashboard-funnel-panel">
          <PanelHead
            title="Visão do funil"
            subtitle="Volume e valor atuais por etapa"
            action={<div className="panel-actions">{pipelines.length > 1 && <SelectControl value={pipelineId} onChange={setPipelineId} options={pipelines.map((pipeline) => pipeline.id)} labels={Object.fromEntries(pipelines.map((pipeline) => [pipeline.id, pipeline.name]))} icon={SlidersHorizontal} />}<button type="button" className="text-link" onClick={() => onOpenKanban(pipelineId)}>Abrir funil <ArrowRight size={15} /></button></div>}
          />
          <div className="dashboard-funnel-list">
            {stageStats.map(({ stage, leads, value }) => (
              <button type="button" className={`dashboard-funnel-row kind-${stage.kind}`} key={stage.id} onClick={() => onOpenLeads({ pipelineId, stageId: stage.id, label: `${pipelines.find((item) => item.id === pipelineId)?.name || "Funil"} · ${stage.name}` })}>
                <span className="dashboard-funnel-label"><i style={{ background: stage.color }} /><strong>{stage.name}</strong><small>{leads.length} {leads.length === 1 ? "lead" : "leads"}</small></span>
                <span className="dashboard-funnel-track"><i style={{ width: `${Math.max(leads.length ? 8 : 0, (leads.length / maxStageCount) * 100)}%`, background: stage.color }} /></span>
                <span className="dashboard-funnel-value"><strong>{currency(value)}</strong><ArrowRight size={15} /></span>
              </button>
            ))}
            {!stageStats.length && <div className="empty-inline">O funil selecionado não possui etapas configuradas.</div>}
          </div>
        </article>

        <article className="panel dashboard-agenda-panel">
          <PanelHead title="Agenda de hoje" subtitle={`${todayTasks.length} compromissos programados`} action={<button type="button" className="text-link" onClick={() => onNavigate("calendar")}>Ver agenda <ArrowRight size={15} /></button>} />
          <div className="dashboard-task-list">
            {todayTasks.slice(0, 6).map((task) => {
              const owner = users.find((user) => user.id === task.ownerId);
              const lead = visibleLeads.find((item) => item.id === task.leadId);
              return (
                <article className={`dashboard-task${task.done ? " done" : ""}`} key={task.id}>
                  <button type="button" className="task-check" disabled={!can("tasks.manage")} onClick={() => void toggleTask(task.id)} aria-label={task.done ? "Reabrir tarefa" : "Concluir tarefa"}>{task.done && <Check size={13} />}</button>
                  <button type="button" className="dashboard-task-copy" onClick={() => onTask(task.id)}><time><Clock3 size={13} />{task.time}</time><strong>{task.title}</strong><span>{lead ? `${lead.name}${lead.company ? ` · ${lead.company}` : ""}` : "Sem lead vinculado"}</span></button>
                  <Avatar user={owner} small />
                </article>
              );
            })}
            {!todayTasks.length && <div className="empty-inline"><CalendarDays size={20} /><span><strong>Agenda livre hoje</strong><small>Adicione retornos e compromissos para manter o acompanhamento ativo.</small></span></div>}
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="panel dashboard-recent-panel">
          <PanelHead title="Leads recentes" subtitle="Últimas oportunidades adicionadas" action={<button type="button" className="text-link" onClick={() => onNavigate("leads")}>Ver todos <ArrowRight size={15} /></button>} />
          <div className="dashboard-recent-list">
            {[...visibleLeads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((lead) => {
              const owner = users.find((user) => user.id === lead.ownerId);
              const stage = allStages.find((item) => item.id === lead.stageId);
              return (
                <button type="button" key={lead.id} onClick={() => onLead(lead.id)} className="dashboard-recent-row">
                  <span className="lead-avatar">{lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                  <span className="dashboard-recent-copy"><strong>{lead.name}</strong><small>{lead.company || "Sem empresa"} · {formatDateTime(lead.createdAt)}</small></span>
                  <OriginBadge origin={lead.origin} />
                  <span className="dashboard-stage"><i style={{ background: stage?.color || "#94a3b8" }} />{stage?.name || "Sem etapa"}</span>
                  <Avatar user={owner} small />
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel dashboard-source-panel">
          <PanelHead title="Origem dos leads" subtitle="Participação dos principais canais" />
          <div className="dashboard-source-list">
            {sources.map((item) => (
              <button type="button" key={item.source} onClick={() => onOpenLeads({ origin: item.source, label: `Origem: ${item.source}` })}>
                <span><OriginBadge origin={item.source} /><small>{item.count} leads</small></span>
                <span className="source-progress"><i style={{ width: `${(item.count / sourceTotal) * 100}%` }} /></span>
                <strong>{Math.round((item.count / sourceTotal) * 100)}%</strong>
              </button>
            ))}
            {!sources.length && <div className="empty-inline">Nenhuma origem registrada.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}
