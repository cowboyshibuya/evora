import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn, initials } from "@/lib/utils";
import type { Entry } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Dropdown, DropdownItem, DropdownSeparator } from "./ui/dropdown-menu";

export function Logo({
  variant = "default",
}: { variant?: "default" | "monochrome" } = {}) {
  return (
    <span
      className={cn("brand", variant === "monochrome" && "brand-monochrome")}
    >
      {variant === "default" && (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="m4 23 8-15h7L11 23H4Z" fill="currentColor" />
          <path d="m14 23 8-15h6l-8 15h-6Z" fill="currentColor" opacity=".5" />
          <path d="M10 26h18v-5H13l-3 5Z" fill="currentColor" />
        </svg>
      )}
      <span>
        evora<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Avatar({
  name,
  className,
  tone = "default",
}: {
  name: string;
  className?: string;
  tone?: "default" | "party";
}) {
  return (
    <span
      className={cn(
        "avatar",
        tone === "party" && `avatar-${name.length % 4}`,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  return (
    <Badge variant="outline" className={cn("status", `status-${value}`)}>
      <span className="status-dot" />
      {label}
    </Badge>
  );
}
export function Empty({
  title = "Nothing here yet",
  description,
  action,
  icon = <Inbox size={24} />,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="app-loading">
      <Logo />
      <Loader2 className="spin" size={22} />
      <p>Getting your workspace ready…</p>
    </div>
  );
}
export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}
export function PanelHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function RecordMenu({
  onEdit,
  onDelete,
  extra,
}: {
  onEdit: () => void;
  onDelete: () => void;
  extra?: ReactNode;
}) {
  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="icon" aria-label="Item actions">
          <MoreHorizontal size={17} />
        </Button>
      }
    >
      {extra}
      <>
        <DropdownItem onSelect={onEdit}>
          <Pencil size={15} />
          Edit item
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem className="danger" onSelect={onDelete}>
          <Trash2 size={15} />
          Delete item
        </DropdownItem>
      </>
    </Dropdown>
  );
}
export function TransactionIcon({ entry }: { entry: Entry }) {
  return (
    <span
      className={cn(
        "transaction-icon",
        entry.amount > 0 && "transaction-income",
      )}
    >
      {entry.amount > 0 ? (
        <ArrowDownLeft size={17} />
      ) : (
        <ArrowUpRight size={17} />
      )}
    </span>
  );
}
export function CheckButton({
  checked,
  label,
  onClick,
  disabled,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      className={cn("check-button", checked && "checked")}
      aria-label={label}
      checked={checked}
      onCheckedChange={onClick}
      disabled={disabled}
    />
  );
}
export function FileIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "file-icon",
        /\.xlsx?$|\.csv$/i.test(name)
          ? "file-sheet"
          : /\.pdf$/i.test(name)
            ? "file-pdf"
            : "",
      )}
    >
      <FileText size={21} />
      <span>
        {name.split(".").length > 1
          ? name.split(".").at(-1)?.slice(0, 4).toUpperCase()
          : "FILE"}
      </span>
    </span>
  );
}
