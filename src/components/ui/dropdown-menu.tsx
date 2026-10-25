import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "end",
  className,
  onOpenChange,
  modal = true,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}) {
  return (
    <Menu.Root onOpenChange={onOpenChange} modal={modal}>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          sideOffset={6}
          align={align}
          className={cn("dropdown-content", className)}
        >
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
export function DropdownItem({
  children,
  onSelect,
  className,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn("dropdown-item", className)}
    >
      {children}
    </Menu.Item>
  );
}
export const DropdownSeparator = () => (
  <Menu.Separator className="dropdown-separator" />
);
export const DropdownLabel = ({ children }: { children: ReactNode }) => (
  <Menu.Label className="dropdown-label">{children}</Menu.Label>
);
