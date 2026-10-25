import type { ReactNode } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  FileText,
  FolderClosed,
  Plus,
  StickyNote,
  Users,
} from "lucide-react";
import { QUICK_ACTIONS, type QuickAction } from "@/lib/quick-actions";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "./ui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "./ui/dropdown-menu";

const icons = {
  invoice: FileText,
  transaction: ArrowDownUp,
  event: CalendarDays,
  note: StickyNote,
  contact: Users,
  document: FolderClosed,
} satisfies Record<QuickAction, typeof Plus>;

export function Shortcut({ second }: { second: string }) {
  return (
    <span className="keyboard-shortcut">
      <span className="sr-only">N then {second.toUpperCase()}</span>
      <kbd aria-hidden="true">N</kbd>
      <kbd aria-hidden="true">{second.toUpperCase()}</kbd>
    </span>
  );
}

export function QuickAddMenu({
  trigger,
  date,
  onOpenChange,
}: {
  trigger?: ReactNode;
  date?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const { quickAdd, canEdit } = useWorkspace();
  return (
    <Dropdown
      className="quick-add-dropdown"
      modal={false}
      align={date ? "start" : "end"}
      onOpenChange={onOpenChange}
      trigger={
        trigger || (
          <Button size="sm" disabled={!canEdit}>
            <Plus size={16} />
            Quick add
            <ChevronDown size={13} />
          </Button>
        )
      }
    >
      <DropdownLabel>
        {date ? `Add for ${date}` : "Add to your workspace"}
      </DropdownLabel>
      {QUICK_ACTIONS.map((action) => {
        const Icon = icons[action.kind];
        return (
          <div key={action.kind}>
            {action.kind === "document" && <DropdownSeparator />}
            <DropdownItem
              disabled={!canEdit}
              onSelect={() => quickAdd(action.kind, date)}
            >
              <Icon size={16} />
              <span>{action.label}</span>
              <Shortcut second={action.key} />
            </DropdownItem>
          </div>
        );
      })}
    </Dropdown>
  );
}
