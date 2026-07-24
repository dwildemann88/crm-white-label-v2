import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useCrm } from "../app/CrmContext";
import { demoCredentials } from "../data/seed";

export function LoginPage() {
  const { login, busy, error, clearError } = useCrm();
  const provider = import.meta.env.VITE_DATA_PROVIDER || "local";
  const isLocal = provider === "local";
  const appName = import.meta.env.VITE_APP_NAME || "CRM Comercial";
  const [email, setEmail] = useState(isLocal ? demoCredentials[0]?.email || "" : "");
  const [password, setPassword] = useState(isLocal ? demoCredentials[0]?.password || "" : "");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-card-brand">
          <span className="login-logo">CRM</span>
          <span>
            <strong>{appName}</strong>
            <small>Gestão comercial</small>
          </span>
        </header>

        <div className="login-card-heading">
          <h1 id="login-title">Acesse sua conta</h1>
          <p>Entre com o e-mail e a senha vinculados à sua organização.</p>
        </div>

        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            clearError();
            try {
              await login(email.trim(), password);
            } catch {
              // A mensagem é exibida pelo contexto.
            }
          }}
        >
          {error && <div className="form-error login-error">{error}</div>}

          <label className="field-label">
            <span>E-mail</span>
            <div className="input-icon login-input">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="voce@empresa.com.br"
                required
              />
            </div>
          </label>

          <label className="field-label">
            <span>Senha</span>
            <div className="input-icon login-input">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button className="primary-button login-submit" disabled={busy}>
            {busy ? "Validando acesso..." : "Entrar"}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>

        {isLocal && (
          <details className="local-access-panel">
            <summary>Perfis do ambiente local</summary>
            <div className="demo-accounts">
              {demoCredentials.map((item) => (
                <button
                  type="button"
                  key={item.email}
                  onClick={() => {
                    setEmail(item.email);
                    setPassword(item.password);
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.email}</span>
                </button>
              ))}
            </div>
          </details>
        )}

        <footer className="login-security">
          <ShieldCheck size={16} />
          <span>Acesso protegido pelas permissões da sua organização.</span>
        </footer>
      </section>
    </main>
  );
}
