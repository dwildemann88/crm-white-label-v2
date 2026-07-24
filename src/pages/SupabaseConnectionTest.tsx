import { CheckCircle2, Database, LoaderCircle, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getCurrentAccess,
  signInWithPassword,
  signOut,
  type AuthenticatedAccess,
} from "../infrastructure/supabase/auth";
import {
  getCrmBootstrap,
  type CrmBootstrap,
} from "../infrastructure/supabase/bootstrap";

export function SupabaseConnectionTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState<AuthenticatedAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bootstrap, setBootstrap] = useState<CrmBootstrap | null>(null);

  async function loadAccess() {
    setLoading(true);
    setError("");

    try {
      const currentAccess = await getCurrentAccess();
      setAccess(currentAccess);
      setBootstrap(currentAccess ? await getCrmBootstrap() : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível consultar o acesso.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccess();
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithPassword(email, password);
      await loadAccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      await signOut();
      setAccess(null);
      setBootstrap(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível sair.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="technical-screen">
        <section className="technical-card technical-loading">
          <LoaderCircle className="spin" size={24} />
          <strong>Verificando conexão</strong>
          <p>Consultando autenticação, organização e permissões.</p>
        </section>
      </main>
    );
  }

  const membership = bootstrap?.memberships[0];

  if (access) {
    return (
      <main className="technical-screen">
        <section className="technical-card">
          <header className="technical-heading">
            <span className="technical-icon success"><CheckCircle2 size={21} /></span>
            <div>
              <span className="eyebrow">Diagnóstico técnico</span>
              <h1>Conexão confirmada</h1>
              <p>O usuário, a organização e o contexto de acesso foram carregados.</p>
            </div>
          </header>

          <div className="technical-status-grid">
            <div><span>Usuário</span><strong>{access.fullName}</strong><small>{access.email}</small></div>
            <div><span>Empresa</span><strong>{access.organizationName}</strong><small>{access.organizationSlug}</small></div>
            <div><span>Cargo</span><strong>{access.roleName}</strong><small>{access.roleCode}</small></div>
            <div><span>Plataforma</span><strong>{access.isPlatformAdmin ? "Administrador" : "Acesso comum"}</strong><small>Permissão global</small></div>
          </div>

          {membership && (
            <section className="technical-detail">
              <div className="technical-detail-title">
                <ShieldCheck size={17} />
                <div><strong>{membership.branding.crm_name}</strong><span>{membership.permissions.length} permissões efetivas</span></div>
              </div>
              <details>
                <summary>Visualizar permissões</summary>
                <pre>{membership.permissions.join("\n")}</pre>
              </details>
            </section>
          )}

          {error && <div className="form-error">{error}</div>}

          <button type="button" className="secondary-button technical-action" onClick={handleLogout}>
            <LogOut size={16} /> Encerrar sessão de teste
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="technical-screen">
      <section className="technical-card compact">
        <header className="technical-heading">
          <span className="technical-icon"><Database size={21} /></span>
          <div>
            <span className="eyebrow">Diagnóstico técnico</span>
            <h1>Validar Supabase</h1>
            <p>Use uma conta autorizada para conferir autenticação e permissões.</p>
          </div>
        </header>

        {error && <div className="form-error">{error}</div>}

        <form className="technical-form" onSubmit={handleLogin}>
          <label className="field-label">
            E-mail
            <span className="input-icon"><Database size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
          </label>
          <label className="field-label">
            Senha
            <span className="input-icon"><LockKeyhole size={16} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span>
          </label>
          <button type="submit" className="primary-button technical-action">Validar acesso</button>
        </form>
      </section>
    </main>
  );
}
