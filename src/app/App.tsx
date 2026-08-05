import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  RefreshCcw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell, type PageId } from "../components/AppShell";
import { LeadDrawer } from "../components/LeadDrawer";
import { LeadModal, TaskModal, UserModal } from "../components/Modals";
import { useCrm } from "./CrmContext";
import { DashboardPage } from "../pages/DashboardPage";
import { KanbanPage } from "../pages/KanbanPage";
import { LeadsPage } from "../pages/LeadsPage";
import { CalendarPage } from "../pages/CalendarPage";
import { InboxPage } from "../pages/InboxPage";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { IntegrationsPage } from "../pages/IntegrationsPage";
import { AdminPage } from "../pages/AdminPage";
import { DeveloperPage } from "../pages/DeveloperPage";
import { LoginPage } from "../pages/LoginPage";
import { SetPasswordPage } from "../pages/SetPasswordPage";
import type { LeadListPreset } from "../core/leadFilters";

interface ModalState {
  type: "lead" | "task" | "user";
  id?: string;
  date?: string;
}

export function App() {
  const {
    session,
    data,
    loading,
    busy,
    error,
    clearError,
    toast,
    visibleLeads,
    can,
    openWhatsAppConversation,
  } = useCrm();

  const [page, setPage] = useState<PageId>("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [globalLeadSearch, setGlobalLeadSearch] = useState("");
  const [inboxConversationId, setInboxConversationId] = useState<string | undefined>();
  const [leadPreset, setLeadPreset] = useState<LeadListPreset | null>(null);
  const [kanbanPipelineId, setKanbanPipelineId] = useState<string | undefined>();
  const [adminPipelineId, setAdminPipelineId] = useState<string | undefined>();
const isInviteSetup =
  new URLSearchParams(window.location.search).get("setup") === "invite";
  const selectedLead = useMemo(
    () => visibleLeads.find((item) => item.id === selectedLeadId) || null,
    [selectedLeadId, visibleLeads],
  );

  const openLeadWhatsApp = async (leadId: string) => {
    try {
      const conversationId = await openWhatsAppConversation(leadId);

      setInboxConversationId(conversationId);
      setSelectedLeadId(null);
      setPage("inbox");
    } catch {
      // O CrmContext já apresenta o erro na interface.
    }
  };


  const openLeadList = (preset?: Omit<LeadListPreset, "id">) => {
    setLeadPreset({ id: Date.now(), ...(preset || {}) });
    setPage("leads");
  };

  const openKanban = (pipelineId?: string) => {
    setKanbanPipelineId(pipelineId);
    setPage("kanban");
  };

  if (loading) {
    return (
      <div className="app-loading">
        <LoaderCircle className="spin" />
        <strong>Preparando seu ambiente...</strong>
        <span>Sincronizando dados, permissões e módulos ativos.</span>
      </div>
    );
  }
if (isInviteSetup) {
  return <SetPasswordPage />;
}
  if (!session || !data) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return (
          <DashboardPage
            onNavigate={(value) => setPage(value as PageId)}
            onLead={setSelectedLeadId}
            onTask={(id) => setModal({ type: "task", id })}
            onOpenLeads={openLeadList}
            onOpenKanban={openKanban}
          />
        );

      case "kanban":
        return (
          <KanbanPage
            onLead={setSelectedLeadId}
            onAdd={() => setModal({ type: "lead" })}
            initialPipelineId={kanbanPipelineId}
            onEditStages={(pipelineId) => {
              setAdminPipelineId(pipelineId);
              setPage("admin");
            }}
          />
        );

      case "leads":
        return (
          <LeadsPage
            onLead={setSelectedLeadId}
            onAdd={() => setModal({ type: "lead" })}
            initialSearch={globalLeadSearch}
            preset={leadPreset}
            onSearchApplied={() => setGlobalLeadSearch("")}
          />
        );

      case "calendar":
        return (
          <CalendarPage
            onAdd={(date) => setModal({ type: "task", date })}
            onEdit={(taskId) => setModal({ type: "task", id: taskId })}
          />
        );

      case "inbox":
        return (
          <InboxPage
            onLead={setSelectedLeadId}
            initialConversationId={inboxConversationId}
          />
        );

      case "analytics":
        return (
          <AnalyticsPage onOpenLeads={openLeadList} />
        );

      case "integrations":
        return can("integrations.manage") ? (
          <IntegrationsPage onLead={setSelectedLeadId} />
        ) : (
          <DashboardPage
            onNavigate={(value) => setPage(value as PageId)}
            onLead={setSelectedLeadId}
            onTask={(id) => setModal({ type: "task", id })}
            onOpenLeads={openLeadList}
            onOpenKanban={openKanban}
          />
        );

      case "admin":
        return can("users.manage") ? (
          <AdminPage initialPipelineId={adminPipelineId} onUser={(id) => setModal({ type: "user", id })} />
        ) : (
          <DashboardPage
            onNavigate={(value) => setPage(value as PageId)}
            onLead={setSelectedLeadId}
            onTask={(id) => setModal({ type: "task", id })}
            onOpenLeads={openLeadList}
            onOpenKanban={openKanban}
          />
        );

      case "developer":
        return can("developer.manage") ? (
          <DeveloperPage />
        ) : (
          <DashboardPage
            onNavigate={(value) => setPage(value as PageId)}
            onLead={setSelectedLeadId}
            onTask={(id) => setModal({ type: "task", id })}
            onOpenLeads={openLeadList}
            onOpenKanban={openKanban}
          />
        );
    }
  };

  return (
    <>
      <AppShell
        page={page}
        onPage={setPage}
        onGlobalSearch={setGlobalLeadSearch}
      >
        {renderPage()}
      </AppShell>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onEdit={() =>
            setModal({
              type: "lead",
              id: selectedLead.id,
            })
          }
          onTask={() =>
            setModal({
              type: "task",
              id: selectedLead.id,
            })
          }
          onWhatsApp={() => {
            void openLeadWhatsApp(selectedLead.id);
          }}
        />
      )}

      {modal?.type === "lead" && (
        <LeadModal
          lead={
            modal.id ? data.leads.find((item) => item.id === modal.id) : null
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "task" && (
        <TaskModal
          task={
            modal.id && data.tasks.some((item) => item.id === modal.id)
              ? data.tasks.find((item) => item.id === modal.id)
              : undefined
          }
          initialDate={modal.date}
          initialLeadId={
            modal.id && data.leads.some((item) => item.id === modal.id)
              ? modal.id
              : undefined
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "user" && (
        <UserModal userId={modal.id} onClose={() => setModal(null)} />
      )}

      {busy && (
        <div className="busy-indicator">
          <LoaderCircle className="spin" size={17} /> Processando...
        </div>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}

      {error && (
        <div className="error-toast">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={clearError} aria-label="Fechar">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}