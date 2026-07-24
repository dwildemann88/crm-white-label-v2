import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { CrmProvider } from "./app/CrmContext";
import { supabaseConfigurationError } from "./infrastructure/supabase/client";
import "./ui-system.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("O elemento raiz da aplicação não foi encontrado.");
}

const provider = import.meta.env.VITE_DATA_PROVIDER || "local";
const missingSupabaseConfiguration =
  provider === "supabase" ? supabaseConfigurationError : null;

function ConfigurationScreen({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f4f6fa",
        color: "#111827",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(100%, 560px)",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "20px",
          padding: "28px",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            padding: "6px 10px",
            borderRadius: "999px",
            background: "#fff7ed",
            color: "#9a3412",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          CONFIGURAÇÃO NECESSÁRIA
        </span>
        <h1 style={{ margin: "18px 0 8px", fontSize: "26px" }}>
          Conecte o projeto ao Supabase
        </h1>
        <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
          {message} O arquivo não é incluído no pacote para evitar o envio de
          credenciais junto ao código.
        </p>
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "12px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <strong style={{ display: "block", marginBottom: "10px" }}>
            Crie o arquivo .env.local na raiz:
          </strong>
          <pre
            style={{
              margin: 0,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              color: "#334155",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >{`VITE_DATA_PROVIDER=supabase\nVITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA\nVITE_DEMO_AUTO_LOGIN=false\nVITE_APP_NAME=CRM Comercial`}</pre>
        </div>
        <p style={{ margin: "18px 0 0", color: "#64748b", fontSize: "13px" }}>
          Depois de salvar o arquivo, encerre o servidor e execute novamente
          <strong> npm run dev</strong>.
        </p>
      </section>
    </main>
  );
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    {missingSupabaseConfiguration ? (
      <ConfigurationScreen message={missingSupabaseConfiguration} />
    ) : (
      <CrmProvider>
        <App />
      </CrmProvider>
    )}
  </StrictMode>,
);
