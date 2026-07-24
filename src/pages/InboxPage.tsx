import {
  ChevronLeft,
  Check,
  CheckCheck,
  CircleAlert,
  ChevronDown,
  Clock3,
  Download,
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCrm } from "../app/CrmContext";
import { Avatar, EmptyState, OriginBadge } from "../components/Common";
import { canUserHandleConversation, eligibleConversationOwners } from "../core/crmConsistency";
import type { Message, MessageStatus, MessageType } from "../core/types";
import { formatDateTime } from "../core/utils";

type ChatFilter = "all" | "unread" | "mine";


type SendableMediaType = Extract<
  MessageType,
  "image" | "audio" | "video" | "document"
>;

interface SelectedMediaDescriptor {
  type: SendableMediaType;
  mimeType: string;
  maxBytes: number;
}

const acceptedMediaInput = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/aac",
  "audio/amr",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "video/mp4",
  "video/3gpp",
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
].join(",");

const mediaMimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  aac: "audio/aac",
  amr: "audio/amr",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  txt: "text/plain",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const mediaRules: Array<{
  type: SendableMediaType;
  mimeTypes: Set<string>;
  maxBytes: number;
}> = [
  {
    type: "image",
    mimeTypes: new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
    maxBytes: 5 * 1024 * 1024,
  },
  {
    type: "audio",
    mimeTypes: new Set([
      "audio/aac",
      "audio/amr",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
    ]),
    maxBytes: 16 * 1024 * 1024,
  },
  {
    type: "video",
    mimeTypes: new Set([
      "video/mp4",
      "video/3gpp",
    ]),
    maxBytes: 16 * 1024 * 1024,
  },
  {
    type: "document",
    mimeTypes: new Set([
      "text/plain",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]),
    maxBytes: 20 * 1024 * 1024,
  },
];

function describeSelectedMedia(
  file: File,
): SelectedMediaDescriptor {
  if (file.size <= 0) {
    throw new Error(
      "O arquivo selecionado está vazio.",
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.trim()
      .toLowerCase() ?? "";

  const mimeType =
    file.type
      .split(";")[0]
      .trim()
      .toLowerCase() ||
    mediaMimeByExtension[extension] ||
    "";

  const rule = mediaRules.find(
    (item) =>
      item.mimeTypes.has(mimeType),
  );

  if (!rule) {
    throw new Error(
      "Este formato de arquivo não é aceito pelo WhatsApp.",
    );
  }

  if (file.size > rule.maxBytes) {
    throw new Error(
      `O arquivo excede o limite de ${formatFileSize(rule.maxBytes)} para ${rule.type === "image" ? "imagens" : rule.type === "audio" ? "áudios" : rule.type === "video" ? "vídeos" : "documentos"}.`,
    );
  }

  return {
    type: rule.type,
    mimeType,
    maxBytes: rule.maxBytes,
  };
}

function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function selectedMediaLabel(
  type: SendableMediaType,
): string {
  if (type === "image") return "Imagem";
  if (type === "audio") return "Áudio";
  if (type === "video") return "Vídeo";
  return "Documento";
}

function OutboundMessageStatus({
  status,
}: {
  status: MessageStatus;
}) {
  if (status === "queued") {
    return (
      <span
        className="message-status queued"
        title="Enviando"
        aria-label="Enviando"
      >
        <LoaderCircle size={13} />
        <span>Enviando</span>
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span
        className="message-status sent"
        title="Enviada"
        aria-label="Enviada"
      >
        <Check size={13} />
        <span>Enviada</span>
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span
        className="message-status delivered"
        title="Entregue"
        aria-label="Entregue"
      >
        <CheckCheck size={13} />
        <span>Entregue</span>
      </span>
    );
  }

  if (status === "read") {
    return (
      <span
        className="message-status read"
        title="Lida"
        aria-label="Lida"
      >
        <CheckCheck size={13} />
        <span>Lida</span>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className="message-status failed"
        title="Falha no envio"
        aria-label="Falha no envio"
      >
        <CircleAlert size={13} />
        <span>Falhou</span>
      </span>
    );
  }

  return null;
}

const genericMediaBodies = new Set([
  "Imagem recebida",
  "Áudio recebido",
  "Vídeo recebido",
  "Documento recebido",
  "Imagem",
]);

function shouldShowMessageBody(
  message: Message,
): boolean {
  if (!message.body.trim()) {
    return false;
  }

  if (
    message.media?.url &&
    genericMediaBodies.has(
      message.body.trim(),
    )
  ) {
    return false;
  }

  return true;
}

function MessageMediaContent({
  message,
}: {
  message: Message;
}) {
  const media = message.media;

  if (!media) {
    return null;
  }

  const messageType =
    message.messageType ?? "text";

  if (media.pending || !media.url) {
    return (
      <div
        className="message-media-pending"
        role="status"
      >
        <LoaderCircle size={17} />
        <span>
          Processando{" "}
          {messageType === "image"
            ? "imagem"
            : messageType === "audio"
              ? "áudio"
              : messageType === "video"
                ? "vídeo"
                : "arquivo"}
          …
        </span>
      </div>
    );
  }

  if (messageType === "image") {
    return (
      <a
        className="message-media-image"
        href={media.url}
        target="_blank"
        rel="noreferrer"
        title="Abrir imagem"
      >
        <img
          src={media.url}
          alt={
            media.fileName ||
            "Imagem recebida pelo WhatsApp"
          }
          loading="lazy"
        />
        <span>
          <ImageIcon size={14} />
          Abrir imagem
        </span>
      </a>
    );
  }

  if (messageType === "audio") {
    return (
      <div className="message-media-audio">
        <span className="message-media-icon">
          <FileAudio size={18} />
        </span>
        <audio
          controls
          preload="metadata"
          src={media.url}
        >
          Seu navegador não suporta áudio.
        </audio>
      </div>
    );
  }

  if (messageType === "video") {
    return (
      <div className="message-media-video">
        <video
          controls
          preload="metadata"
          src={media.url}
        >
          Seu navegador não suporta vídeo.
        </video>
        <span>
          <FileVideo size={14} />
          Vídeo recebido
        </span>
      </div>
    );
  }

  if (messageType === "document") {
    return (
      <a
        className="message-media-document"
        href={media.url}
        target="_blank"
        rel="noreferrer"
      >
        <span className="message-media-document-icon">
          <FileText size={20} />
        </span>

        <span className="message-media-document-copy">
          <strong>
            {media.fileName ||
              "Documento recebido"}
          </strong>
          <small>
            {media.mimeType ||
              "Arquivo do WhatsApp"}
          </small>
        </span>

        <Download size={17} />
      </a>
    );
  }

  return null;
}

function formatWindowRemaining(
  expiresAt: string | null,
  now: number,
): string {
  if (!expiresAt) {
    return "Nenhuma mensagem recebida";
  }

  const remaining =
    new Date(expiresAt).getTime() -
    now;

  if (remaining <= 0) {
    return "Janela encerrada";
  }

  const totalMinutes =
    Math.max(
      1,
      Math.ceil(
        remaining / 60_000,
      ),
    );

  const hours =
    Math.floor(
      totalMinutes / 60,
    );

  const minutes =
    totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min restantes`;
  }

  if (minutes === 0) {
    return `${hours}h restantes`;
  }

  return `${hours}h ${minutes}min restantes`;
}

export function InboxPage({
  onLead,
  initialConversationId,
}: {
  onLead(id: string): void;
  initialConversationId?: string;
}) {
  const {
    data,
    visibleLeads,
    currentUser,
    busy,
    can,
    sendMessage,
    sendWhatsAppMedia,
    sendWhatsAppTemplate,
    transferConversation,
    markConversationRead,
  } = useCrm();

  const allConversations = (data?.conversations || [])
    .filter((conversation) =>
      visibleLeads.some((lead) => lead.id === conversation.leadId),
    )
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const users = (data?.users || []).filter(
    (user) =>
      user.active &&
      ["sales", "sdr", "manager", "super_admin"].includes(user.role),
  );
  const activeOrganization = data?.organizations.find(
    (organization) => organization.id === data.session?.organizationId,
  );

  const [selectedId, setSelectedId] = useState(allConversations[0]?.id || "");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  useEffect(() => {
  if (!initialConversationId) {
    return;
  }

  const conversationExists =
    allConversations.some(
      (conversation) =>
        conversation.id === initialConversationId,
    );

  if (conversationExists) {
    setSelectedId(initialConversationId);
  }
}, [
  initialConversationId,
  data?.conversations,
  visibleLeads,
]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);
  const [selectedMediaType, setSelectedMediaType] =
    useState<SendableMediaType | null>(null);
  const [selectedMimeType, setSelectedMimeType] =
    useState("");
  const [mediaPreviewUrl, setMediaPreviewUrl] =
    useState("");
  const [attachmentError, setAttachmentError] =
    useState("");
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);
  const [clockNow, setClockNow] =
    useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        setClockNow(Date.now());
      },
      30_000,
    );

    return () =>
      window.clearInterval(timer);
  }, []);


  useEffect(() => {
    if (
      !selectedFile ||
      !selectedMediaType ||
      !["image", "audio", "video"].includes(
        selectedMediaType,
      )
    ) {
      setMediaPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(
      selectedFile,
    );

    setMediaPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [
    selectedFile,
    selectedMediaType,
  ]);

  const clearSelectedMedia = () => {
    setSelectedFile(null);
    setSelectedMediaType(null);
    setSelectedMimeType("");
    setAttachmentError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectMediaFile = (
    file: File | null,
  ) => {
    if (!file) {
      return;
    }

    try {
      const descriptor =
        describeSelectedMedia(file);

      setSelectedFile(file);
      setSelectedMediaType(
        descriptor.type,
      );
      setSelectedMimeType(
        descriptor.mimeType,
      );
      setAttachmentError("");
    } catch (caught) {
      clearSelectedMedia();
      setAttachmentError(
        caught instanceof Error
          ? caught.message
          : "O arquivo selecionado é inválido.",
      );
    }
  };

  const filtered = useMemo(
    () =>
      allConversations.filter((conversation) => {
        const lead = visibleLeads.find(
          (item) => item.id === conversation.leadId,
        );
        const matchesSearch =
          `${lead?.name || ""} ${lead?.phone || ""} ${lead?.company || ""}`
            .toLowerCase()
            .includes(search.toLowerCase());
        const matchesFilter =
          filter === "all" ||
          (filter === "unread" && conversation.unread > 0) ||
          (filter === "mine" && conversation.ownerId === currentUser?.id);
        return matchesSearch && matchesFilter;
      }),
    [allConversations, currentUser?.id, filter, search, visibleLeads],
  );

  useEffect(() => {
    if (!filtered.length) return;
    if (!filtered.some((item) => item.id === selectedId))
      setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected =
    allConversations.find((item) => item.id === selectedId) || filtered[0];
  const lead = visibleLeads.find((item) => item.id === selected?.leadId);
  const owner = users.find((user) => user.id === selected?.ownerId);
  const leadOwner = users.find((user) => user.id === lead?.ownerId);
  const pipeline = (data?.pipelines || []).find((item) => item.id === lead?.pipelineId);
  const stage = (data?.stages || []).find((item) => item.id === lead?.stageId);
  const eligibleOwners = lead
    ? eligibleConversationOwners(users, lead.pipelineId)
    : [];
  const conversationOwnerHasAccess = canUserHandleConversation(owner, lead?.pipelineId);
  const messages = useMemo(
    () =>
      (data?.messages || [])
        .filter((message) => message.conversationId === selected?.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data?.messages, selected?.id],
  );

  useEffect(() => {
    if (selected?.id && selected.unread > 0)
      void markConversationRead(selected.id);
  }, [markConversationRead, selected?.id, selected?.unread]);

  if (!allConversations.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Nenhuma conversa disponível"
        text="As conversas recebidas pela API do WhatsApp aparecerão aqui."
      />
    );
  }

  if (!selected || !lead) {
    return (
      <EmptyState
        icon={Search}
        title="Nenhuma conversa neste filtro"
        text="Ajuste a busca ou selecione outra visualização."
      />
    );
  }

  const canReply =
    can("messages.manage") &&
    conversationOwnerHasAccess &&
    (selected.ownerId === currentUser?.id || currentUser?.role === "super_admin");

  const canTransfer =
    can("leads.assign");

  const windowExpiresAt =
    selected.whatsappWindow
      ?.expiresAt ?? null;

  const windowOpen =
    selected.whatsappWindow
      ? Boolean(
          windowExpiresAt &&
            new Date(
              windowExpiresAt,
            ).getTime() >
              clockNow,
        )
      : true;

  const requiresTemplate =
    selected.whatsappWindow
      ? !windowOpen
      : false;

  const canSendFreeText =
    canReply && windowOpen;

  const windowDescription =
    windowOpen
      ? formatWindowRemaining(
          windowExpiresAt,
          clockNow,
        )
      : selected.whatsappWindow
          ?.lastInboundAt
        ? `Encerrada em ${formatDateTime(
            windowExpiresAt ??
              selected.whatsappWindow
                .lastInboundAt,
          )}`
        : "O cliente ainda não iniciou a conversa.";

  const submitMessage = async () => {
    const body = text.trim();

    if (
      !canSendFreeText ||
      busy
    ) {
      return;
    }

    if (
      selectedFile &&
      selectedMediaType
    ) {
      try {
        await sendWhatsAppMedia(
          selected.id,
          {
            file: selectedFile,
            caption:
              selectedMediaType ===
              "audio"
                ? undefined
                : body || undefined,
          },
        );

        clearSelectedMedia();
        setText("");

        if (
          selectedMediaType ===
            "audio" &&
          body
        ) {
          await sendMessage(
            selected.id,
            body,
          );
        }
      } catch {
        // O contexto mantém o arquivo selecionado e exibe o erro global.
      }

      return;
    }

    if (!body) {
      return;
    }

    await sendMessage(
      selected.id,
      body,
    );

    setText("");
  };


  const submitTemplate = async () => {
    if (
      !canReply ||
      !requiresTemplate ||
      busy
    ) {
      return;
    }

    const customerName =
      lead.name.trim();

    if (!customerName) {
      return;
    }

    try {
      await sendWhatsAppTemplate(
        selected.id,
        {
          templateName:
            "reativar_chat",
          languageCode:
            "pt_BR",
          parameters: [
            customerName,
          ],
          bodyPreview:
            `Olá, ${customerName}. Tudo bem?🌞`,
        },
      );
    } catch {
      // O contexto já registra e exibe o erro.
    }
  };

  return (
    <div className={`chat-layout${mobileConversationOpen ? " mobile-conversation-open" : ""}`}>
      <aside className="chat-sidebar">
        <div className="chat-sidebar-head">
          <div>
            <strong>Conversas</strong>
            <span>{allConversations.length} atendimentos no seu escopo</span>
          </div>
        </div>
        <div className="chat-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, empresa ou telefone" />
        </div>
        <div className="chat-filters" role="tablist" aria-label="Filtros de conversas">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas <span>{allConversations.length}</span></button>
          <button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Não lidas <span>{allConversations.filter((item) => item.unread > 0).length}</span></button>
          <button className={filter === "mine" ? "active" : ""} onClick={() => setFilter("mine")}>Minhas</button>
        </div>

        <div className="conversation-list">
          {filtered.map((conversation) => {
            const contact = visibleLeads.find((item) => item.id === conversation.leadId);
            const responsible = users.find((user) => user.id === conversation.ownerId);
            const lastMessage = (data?.messages || [])
              .filter((message) => message.conversationId === conversation.id)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return (
              <button
                type="button"
                key={conversation.id}
                className={conversation.id === selected.id ? "active" : ""}
                onClick={() => { setSelectedId(conversation.id); setMobileConversationOpen(true); }}
              >
                <span className="lead-avatar">{contact?.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <div className="conversation-copy">
                  <div><strong>{contact?.name || "Contato não identificado"}</strong><time>{lastMessage ? formatDateTime(lastMessage.createdAt) : ""}</time></div>
                  <span>{lastMessage?.body || contact?.phone || "Sem mensagem"}</span>
                  <small>{responsible ? `Atendimento: ${responsible.name}` : "Atendimento não atribuído"}</small>
                </div>
                {conversation.unread > 0 && <b>{conversation.unread}</b>}
              </button>
            );
          })}
          {!filtered.length && <div className="empty-conversations">Nenhuma conversa localizada.</div>}
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-head">
          <button type="button" className="chat-mobile-back" onClick={() => setMobileConversationOpen(false)} aria-label="Voltar para a lista de conversas"><ChevronLeft size={18} /></button>
          <button type="button" className="chat-contact" onClick={() => onLead(lead.id)} title="Abrir detalhes do lead">
            <span className="lead-avatar">{lead.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <div>
              <strong>{lead.name}</strong>
              <span>{lead.phone}{lead.company ? ` · ${lead.company}` : ""}</span>
            </div>
          </button>
          <div className="chat-head-actions">
            <OriginBadge origin={lead.origin} />
            <button type="button" className="secondary-button compact" onClick={() => onLead(lead.id)}>Abrir lead</button>
          </div>
        </header>

        <div className="chat-context-bar">
          <div className="chat-context-item">
            <small>Contexto comercial</small>
            <strong>{pipeline?.name || "Sem funil"}</strong>
            <span className="stage-inline"><i style={{ background: stage?.color || "#94a3b8" }} />{stage?.name || "Sem etapa"}</span>
          </div>
          <div className="chat-context-item">
            <small>Responsável comercial</small>
            <span className="person-inline"><Avatar user={leadOwner} small /><strong>{leadOwner?.name || "Não atribuído"}</strong></span>
            <em>{leadOwner?.roleLabel || "Edite o lead para atribuir"}</em>
          </div>
          <div className={`chat-context-item${conversationOwnerHasAccess ? "" : " invalid"}`}>
            <small>Responsável pelo atendimento</small>
            {canTransfer ? (
              <label className="transfer-control">
                <UserRoundCheck size={16} />
                <select
                  value={selected.ownerId}
                  onChange={(event) => void transferConversation(selected.id, event.target.value)}
                  disabled={!eligibleOwners.length}
                  aria-label="Responsável pelo atendimento"
                >
                  {owner && !eligibleOwners.some((user) => user.id === owner.id) && (
                    <option value={owner.id}>{owner.name} — acesso incompatível</option>
                  )}
                  {!owner && <option value="">Selecione um responsável</option>}
                  {eligibleOwners.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} — {user.roleLabel}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            ) : (
              <span className="person-inline"><Avatar user={owner} small /><strong>{owner?.name || "Não atribuído"}</strong></span>
            )}
            {!conversationOwnerHasAccess && <em>Sem acesso ao funil atual</em>}
          </div>
          <div className={`chat-window-status ${windowOpen ? "open" : "closed"}`} title={windowExpiresAt ? `Expira em ${formatDateTime(windowExpiresAt)}` : "Sem mensagem recebida do cliente."}>
            <span>{windowOpen ? <Clock3 size={16} /> : <LockKeyhole size={16} />}</span>
            <div><small>Janela do WhatsApp</small><strong>{windowOpen ? "Aberta" : "Encerrada"}</strong><em>{windowDescription}</em></div>
          </div>
        </div>

        {!conversationOwnerHasAccess && (
          <div className="chat-consistency-alert"><CircleAlert size={16} /><span>O responsável pelo atendimento não possui acesso ao funil deste lead. Transfira a conversa antes de continuar.</span></div>
        )}

        <div className="messages-area">
          <div className="messages-day-separator"><span>Histórico da conversa</span></div>
          {messages.map((message) => {
            const sender = users.find((user) => user.id === message.senderUserId);
            if (message.direction === "internal") return <div className="internal-message" key={message.id}>{message.body}</div>;
            return (
              <div
                key={message.id}
                className={[
                  "message-bubble",
                  message.direction === "outbound" ? "outgoing" : "incoming",
                  message.direction === "outbound" ? `status-${message.status}` : "",
                  message.media ? `has-media media-${message.messageType ?? "file"}` : "",
                ].filter(Boolean).join(" ")}
              >
                {message.direction === "outbound" && sender && <strong className="message-sender">{sender.name}</strong>}
                <MessageMediaContent message={message} />
                {shouldShowMessageBody(message) && <p>{message.body.split("\n").map((line, index) => <span key={index}>{line || <br />}</span>)}</p>}
                <small className="message-meta">
                  <span>{formatDateTime(message.createdAt)}</span>
                  {message.direction === "outbound" && <OutboundMessageStatus status={message.status} />}
                </small>
              </div>
            );
          })}
          {!messages.length && <div className="empty-messages"><MessageCircle size={24} /><strong>Conversa sem mensagens</strong><span>As mensagens aparecerão aqui após o primeiro envio ou recebimento.</span></div>}
        </div>

        <footer className="chat-compose">
          {!canReply && (
            <div className="chat-lock">
              <LockKeyhole size={16} />
              <span>{can("messages.manage") ? `Atendimento atribuído a ${owner?.name || "outro usuário"}. Transfira a conversa para responder.` : "Seu perfil pode acompanhar a conversa, mas não enviar mensagens."}</span>
            </div>
          )}
          {canReply && requiresTemplate && (
            <div className="chat-lock whatsapp-window-lock">
              <div><LockKeyhole size={16} /><span><strong>Janela de 24 horas encerrada</strong>Use um template aprovado para retomar o atendimento.</span></div>
              <button type="button" className="template-button" disabled={busy} onClick={() => void submitTemplate()} title="Enviar o template aprovado reativar_chat."><FileText size={15} />{busy ? "Enviando..." : "Enviar template"}</button>
            </div>
          )}

          {selectedFile && selectedMediaType && (
            <div className={`chat-attachment-preview type-${selectedMediaType}`}>
              <div className="chat-attachment-visual">
                {selectedMediaType === "image" && mediaPreviewUrl ? <img src={mediaPreviewUrl} alt="Prévia da imagem selecionada" /> : selectedMediaType === "video" && mediaPreviewUrl ? <video src={mediaPreviewUrl} controls preload="metadata" /> : selectedMediaType === "audio" ? <FileAudio size={22} /> : <FileText size={22} />}
              </div>
              <div className="chat-attachment-copy">
                <strong>{selectedFile.name}</strong>
                <span>{selectedMediaLabel(selectedMediaType)} · {formatFileSize(selectedFile.size)}{selectedMimeType ? ` · ${selectedMimeType}` : ""}</span>
                {selectedMediaType === "audio" && text.trim() && <small>O texto será enviado separadamente após o áudio.</small>}
              </div>
              <button type="button" className="chat-attachment-remove" onClick={clearSelectedMedia} disabled={busy} title="Remover anexo" aria-label="Remover anexo"><X size={17} /></button>
            </div>
          )}
          {attachmentError && <div className="chat-attachment-error" role="alert"><CircleAlert size={15} />{attachmentError}</div>}

          <div className="composer-row">
            <input ref={fileInputRef} className="chat-file-input" type="file" accept={acceptedMediaInput} onChange={(event) => selectMediaFile(event.target.files?.[0] ?? null)} />
            <button type="button" className="composer-action" disabled={!canSendFreeText || busy} title={canSendFreeText ? "Anexar imagem, áudio, vídeo ou documento" : "A janela do WhatsApp precisa estar aberta para enviar anexos"} aria-label="Selecionar anexo" onClick={() => fileInputRef.current?.click()}><Paperclip size={19} /></button>
            <textarea
              disabled={!canSendFreeText || busy}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={requiresTemplate ? "Envie um template aprovado para retomar a conversa." : selectedMediaType === "audio" ? "Texto opcional; será enviado separadamente após o áudio." : selectedFile ? "Adicione uma legenda opcional ao arquivo." : "Digite uma mensagem"}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }}
            />
            <button type="button" className="send-button" disabled={!canSendFreeText || busy || (!text.trim() && !selectedFile)} onClick={() => void submitMessage()} aria-label="Enviar mensagem">
              {busy && selectedFile ? <LoaderCircle className="chat-send-spinner" size={18} /> : <Send size={18} />}
            </button>
          </div>
          <div className="composer-hint"><span>Enter para enviar · Shift + Enter para quebrar linha</span><span>{text.length}/4096</span></div>
        </footer>
      </section>
    </div>
  );
}

