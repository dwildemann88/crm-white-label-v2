import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { resolveLeadFields } from "../core/leadFields";
import type { Task } from "../core/types";
import { Avatar, PriorityBadge, SelectControl } from "../components/Common";
import { formatDate } from "../core/utils";

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
type TaskStatusFilter = "Pendentes" | "Atrasadas" | "Concluídas" | "Todas";

const isTaskOverdue = (task: Task): boolean => {
  if (task.done) return false;
  const scheduledAt = new Date(`${task.date}T${task.time || "23:59"}:00`);
  return !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() < Date.now();
};

export function CalendarPage({ onAdd, onEdit }: { onAdd(date?: string): void; onEdit(taskId: string): void }) {
  const { data, toggleTask, can } = useCrm();
  const today = new Date();
  const todayKey = toDateKey(today);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [ownerFilter, setOwnerFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("Pendentes");
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const organizationId = data?.session?.organizationId || "sem-organizacao";
  const leadFields = useMemo(
    () => resolveLeadFields(data?.leadFields || [], organizationId),
    [data?.leadFields, organizationId],
  );
  const companyActive = leadFields.some((field) => field.key === "company" && field.active);
  const users = (data?.users || []).filter((user) => user.active);
  const leads = data?.leads || [];
  const allTasks = data?.tasks || [];
  const tasks = allTasks.filter((task) => {
    if (ownerFilter !== "Todos" && task.ownerId !== ownerFilter) return false;
    if (statusFilter === "Pendentes") return !task.done;
    if (statusFilter === "Atrasadas") return isTaskOverdue(task);
    if (statusFilter === "Concluídas") return task.done;
    return true;
  });

  const pendingCount = allTasks.filter((task) => !task.done).length;
  const overdueCount = allTasks.filter(isTaskOverdue).length;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + days }, (_, index) => (index < firstDay ? null : index - firstDay + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTasks = useMemo(
    () => tasks.filter((task) => {
      const date = new Date(`${task.date}T12:00:00`);
      return date.getFullYear() === year && date.getMonth() === month;
    }),
    [tasks, year, month],
  );
  const selectedTasks = [...tasks]
    .filter((task) => task.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcomingTasks = [...tasks]
    .filter((task) => task.date >= todayKey)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 8);
  const agendaTasks = selectedTasks.length ? selectedTasks : upcomingTasks;

  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1, 12);
    setCursor(next);
    setSelectedDate(toDateKey(next));
  };

  return (
    <div className="calendar-page-layout">
      <section className="panel calendar-panel">
        <div className="calendar-header">
          <div>
            <span className="section-kicker">Calendário</span>
            <h2>{monthNames[month]} de {year}</h2>
            <p>Selecione um dia para consultar as tarefas ou adicionar um compromisso.</p>
          </div>
          <div className="calendar-nav">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
            <button type="button" onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1, 12)); setSelectedDate(todayKey); }}>Hoje</button>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight size={17} /></button>
          </div>
        </div>

        <div className="calendar-toolbar">
          <SelectControl value={ownerFilter} onChange={setOwnerFilter} options={["Todos", ...users.map((user) => user.id)]} labels={{ Todos: "Todos os responsáveis", ...Object.fromEntries(users.map((user) => [user.id, user.name])) }} />
          <SelectControl value={statusFilter} onChange={(value) => setStatusFilter(value as TaskStatusFilter)} options={["Pendentes", "Atrasadas", "Concluídas", "Todas"]} />
          <div className="calendar-counts"><span><i className="pending" />{pendingCount} pendentes</span><span><i className="overdue" />{overdueCount} atrasadas</span></div>
        </div>

        <div className="calendar-weekdays">
          {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-cells">
          {cells.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="calendar-cell empty" />;
            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayTasks = monthTasks.filter((task) => task.date === date);
            return (
              <div key={date} className={`calendar-cell${date === todayKey ? " today" : ""}${date === selectedDate ? " selected" : ""}`}>
                <button type="button" className="calendar-day-button" onClick={() => setSelectedDate(date)} aria-label={`Selecionar dia ${day}`}>
                  <span>{day}</span>
                  {dayTasks.length > 0 && <b>{dayTasks.length}</b>}
                </button>
                <div className="calendar-events">
                  {dayTasks.slice(0, 2).map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      className={`${task.done ? "done" : ""}${isTaskOverdue(task) ? " overdue" : ""}`}
                      onClick={() => onEdit(task.id)}
                      title={`${task.time} · ${task.title}`}
                    >
                      <time>{task.time}</time><span>{task.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 2 && <button type="button" className="calendar-more" onClick={() => setSelectedDate(date)}>+{dayTasks.length - 2} tarefas</button>}
                </div>
                {can("tasks.manage") && <button type="button" className="calendar-add-day" onClick={() => onAdd(date)} aria-label={`Adicionar tarefa em ${day}`}><Plus size={14} /></button>}
              </div>
            );
          })}
        </div>
      </section>

      <aside className="panel agenda-side">
        <div className="agenda-side-header">
          <div>
            <span className="section-kicker">Agenda</span>
            <h2>{selectedTasks.length ? formatDate(selectedDate) : "Próximas tarefas"}</h2>
            <p>{selectedTasks.length ? `${selectedTasks.length} compromissos neste dia` : "Nenhuma tarefa no dia selecionado; mostrando as próximas."}</p>
          </div>
          {can("tasks.manage") && <button className="primary-button icon-only" onClick={() => onAdd(selectedDate)} aria-label="Nova tarefa"><Plus size={17} /></button>}
        </div>

        <div className="agenda-list">
          {agendaTasks.map((task) => {
            const owner = users.find((user) => user.id === task.ownerId);
            const lead = leads.find((item) => item.id === task.leadId);
            return (
              <article key={task.id} className={`agenda-item${task.done ? " done" : ""}${isTaskOverdue(task) ? " overdue" : ""}`}>
                <button className="agenda-check" disabled={!can("tasks.manage")} onClick={() => toggleTask(task.id)} aria-label={task.done ? "Reabrir tarefa" : "Concluir tarefa"}>{task.done && <Check size={13} />}</button>
                <button className="agenda-main" onClick={() => onEdit(task.id)}>
                  <span className="agenda-date"><CalendarDays size={14} />{formatDate(task.date)} · {task.time}</span>
                  <strong>{task.title}</strong>
                  <span>{lead ? `${lead.name}${companyActive && lead.company ? ` · ${lead.company}` : ""}` : "Sem lead vinculado"}</span>
                  <small>{task.type}</small>
                </button>
                <div className="agenda-meta"><PriorityBadge value={task.priority} /><Avatar user={owner} small /></div>
                {can("tasks.manage") && <button className="agenda-edit" onClick={() => onEdit(task.id)} aria-label="Editar tarefa"><Edit3 size={15} /></button>}
              </article>
            );
          })}
          {!agendaTasks.length && <div className="empty-state compact"><span><Clock3 size={22} /></span><strong>Nenhuma tarefa</strong><p>Não há compromissos para este filtro.</p></div>}
        </div>

        {can("tasks.manage") && <button className="secondary-button full" onClick={() => onAdd(selectedDate)}><Plus size={17} /> Nova tarefa neste dia</button>}
      </aside>
    </div>
  );
}
