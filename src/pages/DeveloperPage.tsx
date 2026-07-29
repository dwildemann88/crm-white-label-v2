import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  ImagePlus,
  Layers3,
  LayoutTemplate,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { ModalShell, PanelHead } from "../components/Common";
import type { Organization, OrganizationTemplateMode } from "../core/types";
import { fileToDataUrl } from "../core/utils";

function OrganizationPreview({ organization, onClose }: { organization: Organization; onClose(): void }) {
  return (
    <ModalShell
      title={`Prévia — ${organization.name}`}
      subtitle="A identidade da empresa é aplicada sobre o padrão visual único do produto."
      onClose={onClose}
      wide
    >
      <div className="crm-preview">
        <aside>
          <div className="preview-logo">
            {organization.branding.logoUrl ? (
              <img src={organization.branding.logoUrl} alt={organization.name} />
            ) : (
              <strong>{organization.branding.productName.slice(0, 2).toUpperCase()}</strong>
            )}
          </div>
          <b>{organization.branding.productName}</b>
          {['Visão geral', 'Funil de vendas', 'Leads', 'Agenda e tarefas'].map((item) => <span key={item}>{item}</span>)}
        </aside>
        <main>
          <header>
            <div>
              <strong>{organization.name}</strong>
              <small>Operação comercial</small>
            </div>
            <span className="preview-button">Novo lead</span>
          </header>
          <section>
            <div className="preview-kpi"><small>Leads ativos</small><strong>128</strong></div>
            <div className="preview-kpi"><small>Pipeline</small><strong>R$ 420 mil</strong></div>
            <div className="preview-kpi"><small>Conversão</small><strong>18%</strong></div>
            <div className="preview-bars">
              <strong>Funil comercial</strong>
              <i /><i /><i /><i />
            </div>
          </section>
        </main>
      </div>
    </ModalShell>
  );
}

function OrganizationEditor({ organization, onClose }: { organization: Organization; onClose(): void }) {
  const { saveOrganization } = useCrm();
  const [draft, setDraft] = useState(organization);

  return (
    <ModalShell
      title={`Configurar ${organization.name}`}
      subtitle="Altere identificação e logo. O sistema visual permanece padronizado em todas as empresas."
      onClose={onClose}
      wide
    >
      <form
        className="modal-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.name.trim() || !draft.slug.trim() || !draft.branding.productName.trim()) return;
          await saveOrganization({
            ...draft,
            name: draft.name.trim(),
            slug: draft.slug.trim(),
            branding: {
              ...draft.branding,
              productName: draft.branding.productName.trim(),
              companyName: draft.branding.companyName.trim() || draft.name.trim(),
            },
          });
          onClose();
        }}
      >
        <label>
          Nome da empresa
          <input
            value={draft.name}
            onChange={(event) => setDraft((old) => ({
              ...old,
              name: event.target.value,
              branding: { ...old.branding, companyName: event.target.value },
            }))}
          />
        </label>
        <label>
          Identificador interno
          <input
            value={draft.slug}
            onChange={(event) => setDraft((old) => ({
              ...old,
              slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
            }))}
          />
        </label>
        <label>
          Nome exibido no CRM
          <input
            value={draft.branding.productName}
            onChange={(event) => setDraft((old) => ({
              ...old,
              branding: { ...old.branding, productName: event.target.value },
            }))}
          />
        </label>
        <label>
          Status
          <select
            value={draft.active ? "active" : "draft"}
            onChange={(event) => setDraft((old) => ({ ...old, active: event.target.value === "active" }))}
          >
            <option value="draft">Rascunho</option>
            <option value="active">Ativo</option>
          </select>
        </label>
        <label>
          Logo por arquivo
          <span className="file-input-button">
            <ImagePlus size={16} /> Selecionar imagem
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const logoUrl = await fileToDataUrl(file);
                setDraft((old) => ({ ...old, branding: { ...old.branding, logoUrl } }));
              }}
            />
          </span>
        </label>
        <label>
          URL da logo
          <input
            value={draft.branding.logoUrl}
            onChange={(event) => setDraft((old) => ({
              ...old,
              branding: { ...old.branding, logoUrl: event.target.value },
            }))}
            placeholder="https://... ou imagem carregada"
          />
        </label>

        <div className="configuration-note full-field">
          <LayoutTemplate size={17} />
          <div>
            <strong>Interface padronizada</strong>
            <span>Tipografia, contraste, componentes e cores funcionais são iguais em todas as empresas. A personalização fica restrita ao nome e à logo.</span>
          </div>
        </div>

        <div className="configuration-note full-field">
          <Layers3 size={17} />
          <div>
            <strong>Estrutura independente</strong>
            <span>Funis, etapas, papéis, etiquetas e campos continuam configuráveis por organização, sem copiar dados operacionais.</span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={!draft.name.trim() || !draft.slug.trim() || !draft.branding.productName.trim()}>
            <Settings2 size={16} /> Salvar empresa
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function DeveloperPage() {
  const { data, duplicateOrganization, switchOrganization } = useCrm();
  const organizations = data?.organizations || [];
  const currentOrganizationId = data?.session?.organizationId || "";
  const currentOrganization = organizations.find((item) => item.id === currentOrganizationId);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [preview, setPreview] = useState<Organization | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [templateMode, setTemplateMode] =
    useState<OrganizationTemplateMode>("generic");
  const [sourceId, setSourceId] = useState(organizations[0]?.id || "");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (!sourceId && organizations[0]?.id) {
      setSourceId(organizations[0].id);
    }
  }, [organizations, sourceId]);

  return (
    <div className="developer-page">
      <section className="panel developer-hero">
        <div>
          <span className="eyebrow"><Layers3 size={15} /> Administração da plataforma</span>
          <h2>Crie novas operações sem duplicar o código ou alterar o produto manualmente.</h2>
          <p>Nome, logo, usuários, acessos, funis, campos e integrações são configurados por empresa. A interface mantém um padrão único para garantir consistência e usabilidade.</p>
          <span className="current-workspace">Ambiente em edição: <strong>{currentOrganization?.name}</strong></span>
        </div>
        <button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Nova empresa</button>
      </section>

      <div className="organization-grid">
        {organizations.map((organization) => (
          <article className="organization-card" key={organization.id}>
            <div className="organization-preview">
              <span className="preview-sidebar" />
              <div>
                <b>{organization.branding.productName}</b>
                <i /><i /><i />
              </div>
            </div>
            <div className="organization-info">
              <div>
                <h3>{organization.name}</h3>
                <span className={organization.active ? "active" : "draft"}>{organization.active ? "Ativo" : "Rascunho"}</span>
              </div>
              <p>ID: {organization.slug}</p>
              <div className="organization-meta">
                <span><LayoutTemplate size={15} /> Interface padrão do produto</span>
                <span><Layers3 size={15} /> {organization.enabledModules.length} módulos</span>
                <span><ShieldCheck size={15} /> Dados isolados por organização</span>
              </div>
            </div>
            <footer>
              <button className="secondary-button" onClick={() => setPreview(organization)}><Eye size={16} /> Prévia</button>
              <button className="secondary-button" onClick={() => setSelected(organization)}><Settings2 size={16} /> Configurar</button>
              <button
                className="primary-button organization-workspace-button"
                disabled={organization.id === currentOrganizationId}
                onClick={() => void switchOrganization(organization.id)}
              >
                {organization.id === currentOrganizationId ? <Check size={16} /> : <ArrowRight size={16} />}
                {organization.id === currentOrganizationId ? "Ambiente atual" : "Abrir operação"}
              </button>
            </footer>
          </article>
        ))}
      </div>

      <section className="panel template-explanation">
        <PanelHead title="Modelo operacional" subtitle="Uma aplicação, várias empresas e configurações independentes" />
        <div className="architecture-flow">
          <div><b>Empresa</b><span>Nome, logo e administrador</span></div><i>→</i>
          <div><b>Configuração</b><span>Funis, campos, papéis e acessos</span></div><i>→</i>
          <div><b>Integrações</b><span>WhatsApp, Meta e Google por empresa</span></div><i>→</i>
          <div><b>Operação</b><span>Dados isolados por organization_id</span></div>
        </div>
      </section>

      {selected && <OrganizationEditor organization={selected} onClose={() => setSelected(null)} />}
      {preview && <OrganizationPreview organization={preview} onClose={() => setPreview(null)} />}

      {showCreate && (
        <ModalShell
          title="Criar nova empresa"
          subtitle="Copie apenas a estrutura configurável. Leads, mensagens, tarefas e credenciais não são duplicados."
          onClose={() => setShowCreate(false)}
        >
          <form
            className="modal-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const roleSourceId =
                templateMode === "generic"
                  ? currentOrganizationId || sourceId
                  : sourceId;
              if (!name || !slug || !roleSourceId) return;
              await duplicateOrganization(
                roleSourceId,
                name,
                slug,
                templateMode,
              );
              setShowCreate(false);
              setTemplateMode("generic");
              setName("");
              setSlug("");
            }}
          >
            <div className="organization-template-options full-field">
              <button
                type="button"
                className={
                  templateMode === "generic"
                    ? "organization-template-option active"
                    : "organization-template-option"
                }
                onClick={() => setTemplateMode("generic")}
              >
                <LayoutTemplate size={19} />
                <span>
                  <strong>CRM genérico</strong>
                  <small>
                    Estrutura neutra para adaptar a qualquer segmento.
                  </small>
                </span>
                {templateMode === "generic" && <Check size={17} />}
              </button>

              <button
                type="button"
                className={
                  templateMode === "copy"
                    ? "organization-template-option active"
                    : "organization-template-option"
                }
                onClick={() => setTemplateMode("copy")}
              >
                <Copy size={19} />
                <span>
                  <strong>Copiar empresa existente</strong>
                  <small>
                    Replica funis, campos, etiquetas e configurações.
                  </small>
                </span>
                {templateMode === "copy" && <Check size={17} />}
              </button>
            </div>

            {templateMode === "copy" && (
              <label className="full-field">
                Empresa modelo
                <select
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-field">
              Nome da empresa
              <input
                value={name}
                onChange={(event) => {
                  const value = event.target.value;
                  setName(value);
                  if (!slug) setSlug(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }}
              />
            </label>
            <label className="full-field">
              Identificador interno
              <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
            </label>
            <div className="configuration-note full-field">
              <LayoutTemplate size={17} />
              <div>
                <strong>
                  {templateMode === "generic"
                    ? "Estrutura comercial neutra"
                    : "Cópia somente da configuração"}
                </strong>
                <span>
                  {templateMode === "generic"
                    ? "Cria um funil Comercial com etapas genéricas, campos estruturais neutros e sem etiquetas ou campos personalizados."
                    : "Leads, contatos, conversas, tarefas, mensagens, arquivos e credenciais não são copiados."}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={
                  !name ||
                  !slug ||
                  (templateMode === "copy" && !sourceId)
                }
              >
                {templateMode === "generic" ? (
                  <LayoutTemplate size={16} />
                ) : (
                  <Copy size={16} />
                )}
                Criar empresa
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
