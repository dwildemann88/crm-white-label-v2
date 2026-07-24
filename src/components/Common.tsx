import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { LeadPriority, User } from "../core/types";

export function Avatar({
  user,
  small = false,
}: {
  user: User | null | undefined;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar${small ? " small" : ""}`}
      style={
        { "--avatar-color": user?.color || "#ffd43b" } as React.CSSProperties
      }
      title={user?.name}
    >
      {user?.initials || "?"}
    </span>
  );
}

export function PriorityBadge({ value }: { value: LeadPriority }) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    <span className={`priority-badge priority-${slug}`}>
      <i />
      {value}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: string }) {
  const map: Record<string, string> = {
    "Meta Ads": "meta",
    "Google Ads": "google",
    "Landing Page": "landing",
    Indicação: "referral",
    Evento: "event",
    "Entrada manual": "manual",
  };
  return (
    <span className={`origin-badge origin-${map[origin] || "other"}`}>
      {origin}
    </span>
  );
}

export function RoleBadge({ role, label }: { role: string; label: string }) {
  return <span className={`role-badge role-${role}`}>{label}</span>;
}

export function PanelHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={24} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function SelectControl({
  value,
  onChange,
  options,
  labels = {},
  icon: Icon,
}: {
  value: string;
  onChange(value: string): void;
  options: string[];
  labels?: Record<string, string>;
  icon?: LucideIcon;
}) {
  return (
    <label className="select-control">
      {Icon && <Icon size={15} />}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose(): void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <>
      <button className="modal-overlay" onClick={onClose} aria-label="Fechar" />
      <div
        className={`modal-card${wide ? " modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </>
  );
}

export function TagSelector({
  available,
  value,
  onChange,
  colors = {},
  disabled = false,
}: {
  available: string[];
  value: string[];
  onChange(tags: string[]): void;
  colors?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <div className="tag-selector">
      {available.map((tag) => (
        <button
          type="button"
          key={tag}
          className={value.includes(tag) ? "active" : ""}
          style={
            { "--tag-color": colors[tag] || "#ffd43b" } as React.CSSProperties
          }
          disabled={disabled}
          onClick={() =>
            onChange(
              value.includes(tag)
                ? value.filter((item) => item !== tag)
                : [...value, tag],
            )
          }
        >
          {value.includes(tag) && <Check size={12} />} {tag}
        </button>
      ))}
    </div>
  );
}
