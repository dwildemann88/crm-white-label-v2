import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ContactRound,
  Inbox,
  KanbanSquare,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PlugZap,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCrm } from "../app/CrmContext";
import type { Permission } from "../core/permissions";
import { cx, formatDateTime } from "../core/utils";
import { Avatar } from "./Common";

export type PageId =
  | "dashboard"
  | "kanban"
  | "leads"
  | "calendar"
  | "inbox"
  | "analytics"
  | "integrations"
  | "admin"
  | "developer";

type NavItem = {
  id: PageId;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
  module: string;
  permission?: Permission;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { id: "dashboard", label: "Visão geral", shortLabel: "Início", icon: LayoutDashboard, module: "dashboard" },
      { id: "kanban", label: "Funil de vendas", shortLabel: "Funil", icon: KanbanSquare, module: "kanban" },
      { id: "leads", label: "Leads", shortLabel: "Leads", icon: ContactRound, module: "leads" },
      { id: "calendar", label: "Agenda e tarefas", shortLabel: "Agenda", icon: CalendarDays, module: "calendar" },
      { id: "inbox", label: "Conversas", shortLabel: "Conversas", icon: MessageCircle, module: "inbox", permission: "messages.read" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { id: "analytics", label: "Relatórios", shortLabel: "Relatórios", icon: BarChart3, module: "analytics", permission: "reports.read" },
      { id: "integrations", label: "Integrações", shortLabel: "Integrações", icon: PlugZap, module: "integrations", permission: "integrations.manage" },
      { id: "admin", label: "Administração", shortLabel: "Admin", icon: UserCog, module: "admin", permission: "users.manage" },
    ],
  },
  {
    label: "Plataforma",
    items: [
      { id: "developer", label: "Desenvolvedor", shortLabel: "Plataforma", icon: Layers3, module: "developer", permission: "developer.manage" },
    ],
  },
];

const titles: Record<PageId, { title: string; description: string; eyebrow: string }> = {
  dashboard: { title: "Visão geral", description: "Prioridades, desempenho e atividades da operação comercial.", eyebrow: "Operação comercial" },
  kanban: { title: "Funil de vendas", description: "Acompanhe oportunidades e conduza cada negociação para a próxima etapa.", eyebrow: "Pipeline" },
  leads: { title: "Leads", description: "Consulte, filtre e atualize a base comercial com contexto completo.", eyebrow: "Base comercial" },
  calendar: { title: "Agenda e tarefas", description: "Organize retornos, visitas e compromissos da equipe.", eyebrow: "Produtividade" },
  inbox: { title: "Conversas", description: "Atenda pelo WhatsApp com o contexto comercial correto de cada lead.", eyebrow: "Atendimento" },
  analytics: { title: "Relatórios", description: "Transforme dados do funil em decisões e ações comerciais.", eyebrow: "Inteligência comercial" },
  integrations: { title: "Integrações", description: "Acompanhe conexões, roteamento e integridade dos canais externos.", eyebrow: "Conectividade" },
  admin: { title: "Administração", description: "Gerencie usuários, acessos, funis, etiquetas e configurações.", eyebrow: "Configurações" },
  developer: { title: "Desenvolvedor", description: "Crie e mantenha operações independentes na mesma plataforma.", eyebrow: "Plataforma" },
};

interface AppShellProps {
  page: PageId;
  onPage(page: PageId): void;
  onGlobalSearch(query: string): void;
  children: React.ReactNode;
}

export function AppShell({ page, onPage, onGlobalSearch, children }: AppShellProps) {
  const { data, currentUser, can, login, logout, switchOrganization, markNotificationRead } = useCrm();
  const provider = import.meta.env.VITE_DATA_PROVIDER || "local";
  const isLocal = provider === "local";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const globalSearchRef = useRef<HTMLInputElement | null>(null);

  const organization = data?.organizations.find((item) => item.id === data.session?.organizationId);
  const enabledModules = organization?.enabledModules || [];
  const visibleGroups = useMemo(
    () => navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => enabledModules.includes(item.module) && (!item.permission || can(item.permission)),
        ),
      }))
      .filter((group) => group.items.length > 0),
    [can, enabledModules],
  );

  useEffect(() => {
    document.title = `${titles[page].title} · ${organization?.branding.productName || "CRM Comercial"}`;
  }, [organization?.branding.productName, page]);

  useEffect(() => {
    const closeTransientUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      setMobileSearchOpen(false);
      setNotificationsOpen(false);
      setProfileOpen(false);
      setWorkspaceOpen(false);
    };
    window.addEventListener("keydown", closeTransientUi);
    return () => window.removeEventListener("keydown", closeTransientUi);
  }, []);

  const notifications = (data?.notifications || [])
    .filter((item) => item.userId === null || item.userId === currentUser?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((item) => !item.read);
  const demoUsers = isLocal ? (data?.users || []).filter((user) => user.active && user.demoPassword) : [];
  const inboxUnread = data?.conversations.reduce((sum, conversation) => sum + conversation.unread, 0) || 0;
  const pageMeta = titles[page];

  const goTo = (target: PageId) => {
    onPage(target);
    setMobileOpen(false);
    setMobileSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
    setWorkspaceOpen(false);
  };

  const submitSearch = () => {
    const query = globalQuery.trim();
    if (!query) return;
    onGlobalSearch(query);
    goTo("leads");
  };

  return (
    <div className="app-shell">
      <aside className={cx("sidebar", mobileOpen && "open")}>
        <div className="mobile-drawer-controls">
          <strong>Menu</strong>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação">
            <X size={18} />
          </button>
        </div>

        <button type="button" className="brand-wrap" onClick={() => goTo("dashboard")}>
          <span className="brand-mark">
            {organization?.branding.logoUrl ? (
              <img src={organization.branding.logoUrl} alt={organization.branding.companyName || organization.name} />
            ) : (
              <span>{(organization?.branding.productName || "CRM").slice(0, 2).toUpperCase()}</span>
            )}
          </span>
          <span className="brand-copy">
            <strong>{organization?.branding.productName || "CRM Comercial"}</strong>
            <small>{organization?.branding.companyName || organization?.name || "Gestão comercial"}</small>
          </span>
        </button>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-caption">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={cx("nav-item", page === item.id && "active")}
                    onClick={() => goTo(item.id)}
                    aria-current={page === item.id ? "page" : undefined}
                  >
                    <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span>
                    <span className="nav-label">{item.label}</span>
                    {item.id === "inbox" && inboxUnread > 0 && <b>{inboxUnread > 99 ? "99+" : inboxUnread}</b>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-switcher">
            <button type="button" className="profile-mini" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); setWorkspaceOpen(false); }}>
              <Avatar user={currentUser} />
              <span className="profile-copy">
                <strong>{currentUser?.name}</strong>
                <small>{currentUser?.roleLabel}</small>
              </span>
              <ChevronDown className="profile-switch-icon" size={16} />
            </button>

            {profileOpen && (
              <div className="profile-menu">
                <div className="profile-menu-user">
                  <Avatar user={currentUser} />
                  <div><strong>{currentUser?.name}</strong><span>{currentUser?.email}</span></div>
                </div>
                <div className="profile-menu-context">
                  <Building2 size={16} />
                  <span><small>Organização ativa</small><strong>{organization?.name}</strong></span>
                </div>
                {isLocal && demoUsers.length > 1 && (
                  <details className="local-profile-list">
                    <summary><Users size={15} /> Alternar usuário de teste</summary>
                    <div>
                      {demoUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className={cx("profile-option", user.id === currentUser?.id && "active")}
                          onClick={async () => {
                            await login(user.email, user.demoPassword || "");
                            setProfileOpen(false);
                            onPage("dashboard");
                          }}
                        >
                          <Avatar user={user} small />
                          <span><strong>{user.name}</strong><small>{user.roleLabel}</small></span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <button type="button" className="profile-action danger" onClick={() => void logout()}>
                  <LogOut size={16} /> Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && <button type="button" className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Abrir navegação">
              <Menu size={20} />
            </button>

            {data && data.organizations.length > 1 && can("developer.manage") ? (
              <div className="workspace-switcher">
                <button type="button" className="workspace-button" onClick={() => { setWorkspaceOpen((value) => !value); setNotificationsOpen(false); setProfileOpen(false); }}>
                  <span className="workspace-logo">
                    {organization?.branding.logoUrl ? <img src={organization.branding.logoUrl} alt="" /> : organization?.name.slice(0, 1)}
                  </span>
                  <span><small>Organização</small><strong>{organization?.name}</strong></span>
                  <ChevronDown size={15} />
                </button>
                {workspaceOpen && (
                  <div className="workspace-menu">
                    <div className="popover-head"><div><strong>Organizações</strong><span>Selecione o ambiente de trabalho</span></div></div>
                    {data.organizations.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={cx("workspace-option", item.id === organization?.id && "active")}
                        onClick={async () => {
                          if (item.id !== organization?.id) await switchOrganization(item.id);
                          setWorkspaceOpen(false);
                        }}
                      >
                        <span className="workspace-logo">{item.branding.logoUrl ? <img src={item.branding.logoUrl} alt="" /> : item.name.slice(0, 1)}</span>
                        <span><strong>{item.name}</strong><small>{item.active ? "Ativa" : "Rascunho"}</small></span>
                        {item.id === organization?.id && <ShieldCheck size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="workspace-context"><Building2 size={17} /><span>{organization?.name}</span></div>
            )}
          </div>

          <div className="topbar-actions">
            <div className={cx("global-search", mobileSearchOpen && "mobile-open")}>
              <button
                type="button"
                className="global-search-trigger"
                aria-label="Abrir busca global"
                onClick={() => {
                  setMobileSearchOpen(true);
                  requestAnimationFrame(() => globalSearchRef.current?.focus());
                }}
              >
                <Search size={17} />
              </button>
              <input
                ref={globalSearchRef}
                value={globalQuery}
                placeholder="Buscar lead, empresa ou telefone"
                onChange={(event) => setGlobalQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitSearch();
                  if (event.key === "Escape") setMobileSearchOpen(false);
                }}
                aria-label="Busca global"
              />
              {mobileSearchOpen && (
                <button
                  type="button"
                  className="global-search-close"
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Fechar busca"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="notification-wrap">
              <button type="button" className="icon-button notification-button" onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); setWorkspaceOpen(false); }} aria-label="Notificações">
                <Bell size={18} />
                {unread.length > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <div className="popover notifications">
                  <div className="popover-head"><div><strong>Notificações</strong><span>{unread.length} não lidas</span></div></div>
                  <div className="notification-list">
                    {notifications.slice(0, 8).map((item) => (
                      <button type="button" className={cx("notification-item", !item.read && "unread")} key={item.id} onClick={() => markNotificationRead(item.id)}>
                        <span><Inbox size={16} /></span>
                        <div><strong>{item.title}</strong><p>{item.description}</p><small>{formatDateTime(item.createdAt)}</small></div>
                      </button>
                    ))}
                    {!notifications.length && <p className="empty-notifications">Nenhuma notificação no momento.</p>}
                  </div>
                  {unread.length > 0 && (
                    <button type="button" className="notification-footer" onClick={() => markNotificationRead()}>
                      <CheckCheck size={15} /> Marcar todas como lidas
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </header>

        <section className="page-header">
          <div>
            <span className="page-eyebrow">{pageMeta.eyebrow}</span>
            <h1>{pageMeta.title}</h1>
            <p>{pageMeta.description}</p>
          </div>
        </section>

        <section className="page-content">{children}</section>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
        {visibleGroups.flatMap((group) => group.items).slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button type="button" key={item.id} className={cx(page === item.id && "active")} onClick={() => goTo(item.id)}>
              <Icon size={19} />
              <span>{item.shortLabel}</span>
              {item.id === "inbox" && inboxUnread > 0 && <b>{inboxUnread > 9 ? "9+" : inboxUnread}</b>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
