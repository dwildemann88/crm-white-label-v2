import {
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";
import { useEffect, useState } from "react";
import { inviteSupabase } from "../infrastructure/supabase/inviteClient";

export function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
    const [invitedEmail, setInvitedEmail] = useState("");
  useEffect(() => {
  let active = true;

  async function initializeInvite() {
    setCheckingSession(true);
    setError("");
    setInvitedEmail("");

    try {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");

      const hashParams = new URLSearchParams(
        currentUrl.hash.replace(/^#/, ""),
      );

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } =
          await inviteSupabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (sessionError) {
          throw sessionError;
        }
      } else if (code) {
        const { error: exchangeError } =
          await inviteSupabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          throw exchangeError;
        }
      } else {
        throw new Error(
          "O link não contém uma sessão válida de convite.",
        );
      }

      const {
        data: { user },
        error: userError,
      } = await inviteSupabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user?.email) {
        throw new Error(
          "Não foi possível identificar o usuário convidado.",
        );
      }

      if (!active) return;

      setInvitedEmail(user.email);

      window.history.replaceState(
        {},
        document.title,
        `${currentUrl.pathname}?setup=invite`,
      );
    } catch (caught) {
      if (!active) return;

      console.error("[invite-setup]", caught);

      setError(
        caught instanceof Error
          ? caught.message
          : "Este convite é inválido, expirou ou já foi utilizado.",
      );
    } finally {
      if (active) {
        setCheckingSession(false);
      }
    }
  }

  void initializeInvite();

  return () => {
    active = false;
  };
}, []);

  if (checkingSession) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-card-heading">
            <h1>Validando convite</h1>
            <p>Aguarde enquanto confirmamos seu acesso.</p>
          </div>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-card-heading">
            <CheckCircle2 size={34} />
            <h1>Senha definida</h1>
            <p>
              Seu acesso foi configurado. Você será direcionado para a tela de
              login.
            </p>
          </div>
        </section>
      </main>
    );
  }
if (error && !invitedEmail) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-card-heading">
          <h1>Convite inválido</h1>

          <p>
            {error}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button login-submit"
          onClick={() => {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );

            window.location.reload();
          }}
        >
          Voltar para o login
        </button>
      </section>
    </main>
  );
}
  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="password-title">
        <header className="login-card-brand">
          <span className="login-logo">CRM</span>

          <span>
            <strong>Configuração de acesso</strong>
            <small>Primeiro acesso</small>
          </span>
        </header>

        <div className="login-card-heading">
          <h1 id="password-title">Defina sua senha</h1>

          <p>
            Escolha a senha que será utilizada para entrar no CRM.
          </p>
        </div>
{invitedEmail && (
  <div className="invite-account-notice">
    <span>Você está configurando o acesso de:</span>
    <strong>{invitedEmail}</strong>
  </div>
)}
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");

            if (password.length < 8) {
              setError("A senha precisa possuir pelo menos 8 caracteres.");
              return;
            }

            if (password !== passwordConfirmation) {
              setError("As senhas informadas não são iguais.");
              return;
            }

            setBusy(true);

try {
 const {
  data: { user },
  error: userError,
} = await inviteSupabase.auth.getUser();

if (userError) {
  throw userError;
}

const sessionEmail = user?.email ?? "";

if (
  !sessionEmail ||
  !invitedEmail ||
  sessionEmail.toLowerCase() !== invitedEmail.toLowerCase()
) {
  throw new Error(
    "A sessão do convite não corresponde ao usuário exibido. Solicite um novo convite.",
  );
}
  const { error: updateError } =
    await inviteSupabase.auth.updateUser({
      password,
    });

              if (updateError) {
                throw updateError;
              }

              setCompleted(true);

              await inviteSupabase.auth.signOut();

              window.setTimeout(() => {
                window.history.replaceState(
                  {},
                  document.title,
                  window.location.pathname,
                );

                window.location.reload();
              }, 1500);
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Não foi possível definir a senha.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && <div className="form-error login-error">{error}</div>}

          <label className="field-label">
            <span>Nova senha</span>

            <div className="input-icon login-input">
              <LockKeyhole size={18} />

              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="No mínimo 8 caracteres"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          <label className="field-label">
            <span>Confirme a senha</span>

            <div className="input-icon login-input">
              <LockKeyhole size={18} />

              <input
                type={showPassword ? "text" : "password"}
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                autoComplete="new-password"
                placeholder="Digite novamente"
                required
              />
            </div>
          </label>

          <button
            type="submit"
            className="primary-button login-submit"
            disabled={busy || Boolean(error && !password)}
          >
            {busy ? "Salvando senha..." : "Concluir acesso"}
          </button>
        </form>
      </section>
    </main>
  );
}