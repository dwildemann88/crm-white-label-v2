import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  Layers3,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, OriginBadge, SelectControl } from "../components/Common";
import { canUserOwnLead } from "../core/crmConsistency";
import type { LeadListPreset } from "../core/leadFilters";
import { currency, downloadCsv, localDateKey } from "../core/utils";

interface AnalyticsPageProps {
  onOpenLeads?(preset?: Omit<LeadListPreset, "id">): void;
}

const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  return { from: localDateKey(start), to: localDateKey(end) };
}

function minutesLabel(minutes: number | null) {
  if (minutes === null) return "Sem dados";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
  tone: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`report-kpi-icon ${tone}`}><Icon size={20} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      {onClick && <ArrowRight className="report-kpi-arrow" size={17} />}
    </>
  );
  return onClick ? (
    <button type="button" className="report-kpi interactive" onClick={onClick}>{content}</button>
  ) : (
    <article className="report-kpi">{content}</article>
  );
}

export function AnalyticsPage({ onOpenLeads }: AnalyticsPageProps) {
  const { data, visibleLeads } = useCrm();
  const initialRange = useMemo(defaultRange, []);
  const pipelines = (data?.pipelines || []).filter((pipeline) => pipeline.active);
  const allStages = [...(data?.stages || [])].sort((a, b) => a.order - b.order);
  const users = (data?.users || []).filter((user) => user.active);
  const [pipelineId, setPipelineId] = useState("Todos");
  const [ownerId, setOwnerId] = useState("Todos");
  const [origin, setOrigin] = useState("Todas");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);

  const origins = useMemo(
    () => Array.from(new Set(visibleLeads.map((lead) => lead.origin))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [visibleLeads],
  );
  const eligibleOwners = useMemo(
    () => users.filter((user) => pipelineId === "Todos" || canUserOwnLead(user, pipelineId)),
    [pipelineId, users],
  );

  const reportLeads = useMemo(
    () => visibleLeads.filter((lead) => {
      const createdAt = lead.createdAt.slice(0, 10);
      return (
        (pipelineId === "Todos" || lead.pipelineId === pipelineId) &&
        (ownerId === "Todos" || lead.ownerId === ownerId) &&
        (origin === "Todas" || lead.origin === origin) &&
        (!dateFrom || createdAt >= dateFrom) &&
        (!dateTo || createdAt <= dateTo)
      );
    }),
    [visibleLeads, pipelineId, ownerId, origin, dateFrom, dateTo],
  );

  const previousRange = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    const start = new Date(`${dateFrom}T12:00:00`);
    const end = new Date(`${dateTo}T12:00:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (days - 1));
    return { from: localDateKey(previousStart), to: localDateKey(previousEnd) };
  }, [dateFrom, dateTo]);

  const previousLeads = useMemo(
    () => previousRange
      ? visibleLeads.filter((lead) => {
          const createdAt = lead.createdAt.slice(0, 10);
          return (
            (pipelineId === "Todos" || lead.pipelineId === pipelineId) &&
            (ownerId === "Todos" || lead.ownerId === ownerId) &&
            (origin === "Todas" || lead.origin === origin) &&
            createdAt >= previousRange.from &&
            createdAt <= previousRange.to
          );
        })
      : [],
    [visibleLeads, pipelineId, ownerId, origin, previousRange],
  );

  const stageById = new Map(allStages.map((stage) => [stage.id, stage]));
  const won = reportLeads.filter((lead) => stageById.get(lead.stageId)?.kind === "won");
  const lost = reportLeads.filter((lead) => stageById.get(lead.stageId)?.kind === "lost");
  const open = reportLeads.filter((lead) => stageById.get(lead.stageId)?.kind === "open");
  const pipelineValue = open.reduce((sum, lead) => sum + lead.value, 0);
  const wonValue = won.reduce((sum, lead) => sum + lead.value, 0);
  const closedConversion = percent(won.length, won.length + lost.length);
  const averageWonTicket = won.length ? wonValue / won.length : 0;
  const previousWon = previousLeads.filter((lead) => stageById.get(lead.stageId)?.kind === "won");
  const previousLost = previousLeads.filter((lead) => stageById.get(lead.stageId)?.kind === "lost");
  const previousOpen = previousLeads.filter((lead) => stageById.get(lead.stageId)?.kind === "open");
  const previousPipelineValue = previousOpen.reduce((sum, lead) => sum + lead.value, 0);
  const previousWonValue = previousWon.reduce((sum, lead) => sum + lead.value, 0);
  const previousConversion = percent(previousWon.length, previousWon.length + previousLost.length);
  const previousTicket = previousWon.length ? previousWonValue / previousWon.length : 0;

  const comparisonText = (current: number, previous: number) => {
    if (!previousRange) return "Sem comparação de período";
    if (previous === 0) return current === 0 ? "Sem variação no período anterior" : "Sem base no período anterior";
    const variation = Math.round(((current - previous) / Math.abs(previous)) * 100);
    if (variation === 0) return "Estável em relação ao período anterior";
    return `${variation > 0 ? "+" : ""}${variation}% vs período anterior`;
  };

  const reportLeadIds = new Set(reportLeads.map((lead) => lead.id));
  const reportTasks = (data?.tasks || []).filter((task) => task.leadId && reportLeadIds.has(task.leadId));
  const now = Date.now();
  const overdueTasks = reportTasks.filter((task) => {
    if (task.done) return false;
    const scheduled = new Date(`${task.date}T${task.time || "23:59"}:00`).getTime();
    return Number.isFinite(scheduled) && scheduled < now;
  });
  const openWithoutNextTask = open.filter((lead) => !reportTasks.some((task) => task.leadId === lead.id && !task.done));
  const invalidOwners = reportLeads.filter((lead) => !canUserOwnLead(users.find((user) => user.id === lead.ownerId), lead.pipelineId));
  const unreadConversations = (data?.conversations || []).filter(
    (conversation) => reportLeadIds.has(conversation.leadId) && conversation.unread > 0,
  );

  const leadIdByConversation = new Map(
    (data?.conversations || []).map((conversation) => [conversation.id, conversation.leadId]),
  );
  const firstOutboundByLead = new Map<string, string>();
  (data?.messages || [])
    .filter((message) => message.direction === "outbound")
    .forEach((message) => {
      const leadId = leadIdByConversation.get(message.conversationId);
      if (!leadId || !reportLeadIds.has(leadId)) return;
      const current = firstOutboundByLead.get(leadId);
      if (!current || message.createdAt < current) firstOutboundByLead.set(leadId, message.createdAt);
    });
  const responseMinutes = reportLeads.flatMap((lead) => {
    const firstOutbound = firstOutboundByLead.get(lead.id);
    if (!firstOutbound) return [];
    const difference = (new Date(firstOutbound).getTime() - new Date(lead.createdAt).getTime()) / 60_000;
    return Number.isFinite(difference) && difference >= 0 ? [difference] : [];
  });
  const averageResponse = responseMinutes.length
    ? responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length
    : null;

  const funnelGroups = pipelines
    .filter((pipeline) => pipelineId === "Todos" ? reportLeads.some((lead) => lead.pipelineId === pipeline.id) : pipeline.id === pipelineId)
    .map((pipeline) => {
      const pipelineLeads = reportLeads.filter((lead) => lead.pipelineId === pipeline.id);
      const stages = allStages.filter((stage) => stage.pipelineId === pipeline.id);
      const maxCount = Math.max(1, ...stages.map((stage) => pipelineLeads.filter((lead) => lead.stageId === stage.id).length));
      return {
        pipeline,
        total: pipelineLeads.length,
        stages: stages.map((stage) => {
          const leads = pipelineLeads.filter((lead) => lead.stageId === stage.id);
          return {
            stage,
            count: leads.length,
            value: leads.reduce((sum, lead) => sum + lead.value, 0),
            share: percent(leads.length, pipelineLeads.length),
            width: Math.max(leads.length ? 8 : 0, (leads.length / maxCount) * 100),
          };
        }),
      };
    });

  const sourceStats = origins
    .map((name) => {
      const leads = reportLeads.filter((lead) => lead.origin === name);
      const sourceWon = leads.filter((lead) => stageById.get(lead.stageId)?.kind === "won");
      const sourceLost = leads.filter((lead) => stageById.get(lead.stageId)?.kind === "lost");
      return {
        name,
        leads: leads.length,
        pipeline: leads.filter((lead) => stageById.get(lead.stageId)?.kind === "open").reduce((sum, lead) => sum + lead.value, 0),
        won: sourceWon.length,
        conversion: percent(sourceWon.length, sourceWon.length + sourceLost.length),
      };
    })
    .filter((item) => item.leads > 0)
    .sort((a, b) => b.leads - a.leads);

  const ownerStats = eligibleOwners
    .map((user) => {
      const leads = reportLeads.filter((lead) => lead.ownerId === user.id);
      const ownerWon = leads.filter((lead) => stageById.get(lead.stageId)?.kind === "won");
      const ownerLost = leads.filter((lead) => stageById.get(lead.stageId)?.kind === "lost");
      const active = leads.filter((lead) => stageById.get(lead.stageId)?.kind === "open");
      const inconsistent = leads.filter((lead) => !canUserOwnLead(user, lead.pipelineId)).length;
      const ownerTasks = reportTasks.filter((task) => task.ownerId === user.id);
      const overdue = ownerTasks.filter((task) => {
        if (task.done) return false;
        const scheduled = new Date(`${task.date}T${task.time || "23:59"}:00`).getTime();
        return Number.isFinite(scheduled) && scheduled < now;
      }).length;
      return {
        user,
        leads: leads.length,
        active: active.length,
        pipeline: active.reduce((sum, lead) => sum + lead.value, 0),
        won: ownerWon.length,
        conversion: percent(ownerWon.length, ownerWon.length + ownerLost.length),
        overdue,
        inconsistent,
      };
    })
    .filter((item) => item.leads > 0 || item.overdue > 0)
    .sort((a, b) => b.pipeline - a.pipeline);

  const trendBuckets = useMemo(() => {
    const start = dateFrom ? new Date(`${dateFrom}T12:00:00`) : new Date(Date.now() - 29 * 86_400_000);
    const end = dateTo ? new Date(`${dateTo}T12:00:00`) : new Date();
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const monthly = days > 62;
    const buckets = new Map<string, { key: string; label: string; count: number }>();
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = monthly
        ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
        : localDateKey(cursor);
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          label: monthly
            ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(cursor)
            : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(cursor),
          count: 0,
        });
      }
      monthly ? cursor.setMonth(cursor.getMonth() + 1, 1) : cursor.setDate(cursor.getDate() + 1);
    }
    reportLeads.forEach((lead) => {
      const key = monthly ? lead.createdAt.slice(0, 7) : lead.createdAt.slice(0, 10);
      const bucket = buckets.get(key);
      if (bucket) bucket.count += 1;
    });
    return Array.from(buckets.values());
  }, [dateFrom, dateTo, reportLeads]);
  const maxTrend = Math.max(1, ...trendBuckets.map((bucket) => bucket.count));

  const applyPeriod = (period: "all" | "month" | 30 | 90) => {
    if (period === "all") { setDateFrom(""); setDateTo(""); return; }
    const end = new Date();
    const start = new Date(end);
    if (period === "month") start.setDate(1);
    else start.setDate(end.getDate() - (period - 1));
    setDateFrom(localDateKey(start));
    setDateTo(localDateKey(end));
  };

  const openReportLeads = (preset: Omit<LeadListPreset, "id"> = {}) => onOpenLeads?.({
    pipelineId: pipelineId === "Todos" ? undefined : pipelineId,
    ownerId: ownerId === "Todos" ? undefined : ownerId,
    origin: origin === "Todas" ? undefined : origin,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    ...preset,
  });

  const exportReport = () => downloadCsv(
    "relatorio-comercial.csv",
    reportLeads.map((lead) => ({
      Lead: lead.name,
      Empresa: lead.company,
      Origem: lead.origin,
      Funil: pipelines.find((pipeline) => pipeline.id === lead.pipelineId)?.name,
      Etapa: allStages.find((stage) => stage.id === lead.stageId)?.name,
      Responsável: users.find((user) => user.id === lead.ownerId)?.name,
      Valor: lead.value,
      CriadoEm: lead.createdAt,
    })),
  );

  return (
    <div className="analytics-page">
      <section className="panel report-toolbar">
        <div className="report-filter-grid">
          <SelectControl value={pipelineId} onChange={(value) => { setPipelineId(value); setOwnerId("Todos"); }} options={["Todos", ...pipelines.map((pipeline) => pipeline.id)]} labels={{ Todos: "Todos os funis", ...Object.fromEntries(pipelines.map((pipeline) => [pipeline.id, pipeline.name])) }} icon={Layers3} />
          <SelectControl value={ownerId} onChange={setOwnerId} options={["Todos", ...eligibleOwners.map((user) => user.id)]} labels={{ Todos: "Todos os responsáveis", ...Object.fromEntries(eligibleOwners.map((user) => [user.id, user.name])) }} icon={Users} />
          <SelectControl value={origin} onChange={setOrigin} options={["Todas", ...origins]} labels={{ Todas: "Todas as origens" }} icon={Target} />
          <label className="report-date-field"><CalendarRange size={16} /><span>De</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="report-date-field"><CalendarRange size={16} /><span>Até</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
        </div>
        <div className="report-toolbar-footer">
          <div className="period-presets">
            <button type="button" onClick={() => applyPeriod(30)}>Últimos 30 dias</button>
            <button type="button" onClick={() => applyPeriod(90)}>Últimos 90 dias</button>
            <button type="button" onClick={() => applyPeriod("month")}>Mês atual</button>
            <button type="button" onClick={() => applyPeriod("all")}>Todo o histórico</button>
          </div>
          <button type="button" className="secondary-button" onClick={exportReport} disabled={!reportLeads.length}><Download size={17} /> Exportar recorte</button>
        </div>
      </section>

      <section className="report-kpi-grid">
        <KpiCard icon={BarChart3} label="Leads no período" value={number(reportLeads.length)} detail={comparisonText(reportLeads.length, previousLeads.length)} tone="blue" onClick={() => openReportLeads()} />
        <KpiCard icon={CircleDollarSign} label="Pipeline aberto" value={currency(pipelineValue)} detail={`${open.length} oportunidades · ${comparisonText(pipelineValue, previousPipelineValue)}`} tone="indigo" onClick={() => openReportLeads({ special: "open_lead", label: "Pipeline aberto" })} />
        <KpiCard icon={CheckCircle2} label="Negócios ganhos" value={number(won.length)} detail={`${currency(wonValue)} · ${comparisonText(won.length, previousWon.length)}`} tone="green" onClick={() => openReportLeads({ special: "won_lead", label: "Negócios ganhos" })} />
        <KpiCard icon={Target} label="Conversão de fechamentos" value={`${closedConversion}%`} detail={`${won.length} de ${won.length + lost.length} encerrados · ${comparisonText(closedConversion, previousConversion)}`} tone="violet" />
        <KpiCard icon={TrendingUp} label="Ticket médio ganho" value={currency(averageWonTicket)} detail={comparisonText(averageWonTicket, previousTicket)} tone="amber" onClick={() => openReportLeads({ special: "won_lead", label: "Negócios ganhos" })} />
        <KpiCard icon={Clock3} label="Tempo até o primeiro envio" value={minutesLabel(averageResponse)} detail={`${responseMinutes.length} leads com mensagem de saída mensurável`} tone="cyan" />
      </section>

      <section className="panel report-trend-panel">
        <div className="panel-head">
          <div><h2>Entrada de leads no período</h2><p>Distribuição temporal das novas oportunidades conforme os filtros aplicados.</p></div>
          <span className="report-scope-badge">{dateFrom || "Início"} — {dateTo || "Hoje"}</span>
        </div>
        <div className="report-trend-chart" role="img" aria-label="Gráfico de entrada de leads por período">
          {trendBuckets.map((bucket) => (
            <div className="trend-column" key={bucket.key} title={`${bucket.label}: ${bucket.count} leads`}>
              <span className="trend-value">{bucket.count || ""}</span>
              <div><i style={{ height: `${Math.max(bucket.count ? 8 : 2, (bucket.count / maxTrend) * 100)}%` }} /></div>
              <small>{bucket.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="report-funnel-stack">
        {funnelGroups.map((group) => (
          <article className="panel report-funnel-panel" key={group.pipeline.id}>
            <div className="panel-head">
              <div><h2>{group.pipeline.name}</h2><p>Distribuição atual por etapa. Os valores representam o estado atual dos leads que entraram no período.</p></div>
              <span className="report-scope-badge">{group.total} leads</span>
            </div>
            <div className="report-funnel-list">
              {group.stages.map((item) => (
                <button
                  type="button"
                  className={`report-funnel-row kind-${item.stage.kind}`}
                  key={item.stage.id}
                  onClick={() => openReportLeads({ pipelineId: group.pipeline.id, stageId: item.stage.id, label: item.stage.name })}
                >
                  <span className="report-funnel-name"><i style={{ background: item.stage.color }} /><strong>{item.stage.name}</strong><small>{item.share}% do funil</small></span>
                  <span className="report-funnel-track"><i style={{ width: `${item.width}%`, background: item.stage.color }} /></span>
                  <span className="report-funnel-metrics"><strong>{item.count}</strong><small>{currency(item.value)}</small><ArrowRight size={15} /></span>
                </button>
              ))}
            </div>
          </article>
        ))}
        {!funnelGroups.length && <section className="panel report-empty">Nenhum funil possui leads no recorte selecionado.</section>}
      </section>

      <section className="report-two-columns">
        <article className="panel report-source-panel">
          <div className="panel-head"><div><h2>Desempenho por origem</h2><p>Volume, pipeline e resultado por canal de aquisição.</p></div></div>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>Origem</th><th>Leads</th><th>Pipeline</th><th>Ganhos</th><th>Conversão</th><th /></tr></thead>
              <tbody>{sourceStats.map((item) => (
                <tr key={item.name} role="button" tabIndex={0} onClick={() => openReportLeads({ origin: item.name, label: item.name })} onKeyDown={(event) => event.key === "Enter" && openReportLeads({ origin: item.name, label: item.name })}>
                  <td><OriginBadge origin={item.name} /></td><td>{item.leads}</td><td>{currency(item.pipeline)}</td><td>{item.won}</td>
                  <td><span className="conversion-cell"><span><i style={{ width: `${item.conversion}%` }} /></span><strong>{item.conversion}%</strong></span></td>
                  <td><ArrowRight size={15} /></td>
                </tr>
              ))}</tbody>
            </table>
            {!sourceStats.length && <div className="report-empty compact">Nenhuma origem disponível neste período.</div>}
          </div>
        </article>

        <article className="panel report-team-panel">
          <div className="panel-head"><div><h2>Produtividade da equipe</h2><p>Carteira atual, pipeline, fechamentos e pendências por responsável.</p></div></div>
          <div className="team-performance-list">
            {ownerStats.map((item) => (
              <button type="button" className="team-performance-card" key={item.user.id} onClick={() => openReportLeads({ ownerId: item.user.id, label: item.user.name })}>
                <div className="team-person"><Avatar user={item.user} /><span><strong>{item.user.name}</strong><small>{item.user.roleLabel}</small></span><ArrowRight size={15} /></div>
                <dl>
                  <div><dt>Ativos</dt><dd>{item.active}</dd></div>
                  <div><dt>Pipeline</dt><dd>{currency(item.pipeline)}</dd></div>
                  <div><dt>Ganhos</dt><dd>{item.won}</dd></div>
                  <div><dt>Conversão</dt><dd>{item.conversion}%</dd></div>
                </dl>
                <div className="team-card-alerts">
                  {item.overdue > 0 && <span className="team-alert"><AlertTriangle size={14} /> {item.overdue} tarefas atrasadas</span>}
                  {item.inconsistent > 0 && <span className="team-alert critical"><UserRoundCheck size={14} /> {item.inconsistent} acessos incompatíveis</span>}
                </div>
              </button>
            ))}
            {!ownerStats.length && <div className="report-empty compact">Nenhum responsável possui dados no recorte atual.</div>}
          </div>
        </article>
      </section>

      <section className="panel report-health-panel">
        <div className="panel-head"><div><h2>Saúde operacional</h2><p>Pontos que exigem ação da equipe, não apenas acompanhamento.</p></div></div>
        <div className="health-grid">
          <button type="button" className={overdueTasks.length ? "critical" : "healthy"} onClick={() => openReportLeads({ special: "overdue_task", label: "Tarefas atrasadas" })}><span><AlertTriangle size={19} /></span><div><strong>{overdueTasks.length}</strong><p>Tarefas atrasadas</p><small>Compromissos vencidos no recorte.</small></div><ArrowRight size={16} /></button>
          <button type="button" className={openWithoutNextTask.length ? "attention" : "healthy"} onClick={() => openReportLeads({ special: "without_next_task", label: "Sem próxima tarefa" })}><span><CalendarRange size={19} /></span><div><strong>{openWithoutNextTask.length}</strong><p>Sem próxima tarefa</p><small>Oportunidades abertas sem atividade pendente.</small></div><ArrowRight size={16} /></button>
          <button type="button" className={unreadConversations.length ? "attention" : "healthy"} onClick={() => openReportLeads({ special: "unread_conversation", label: "Conversas não lidas" })}><span><Clock3 size={19} /></span><div><strong>{unreadConversations.length}</strong><p>Conversas não lidas</p><small>Atendimentos vinculados ao recorte.</small></div><ArrowRight size={16} /></button>
          <button type="button" className={invalidOwners.length ? "critical" : "healthy"} onClick={() => openReportLeads({ special: "invalid_owner", label: "Responsabilidade inconsistente" })}><span><UserRoundCheck size={19} /></span><div><strong>{invalidOwners.length}</strong><p>Responsabilidade inconsistente</p><small>Usuário ausente ou sem acesso ao funil.</small></div><ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}
