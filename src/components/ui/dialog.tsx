import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "./button";

const dialogVariants = cva("dialog-content", {
  variants: {
    size: {
      default: "",
      wide: "dialog-wide",
      note: "dialog-note",
      search: "search-dialog",
    },
  },
  defaultVariants: { size: "default" },
});

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size,
}: VariantProps<typeof dialogVariants> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay" />
        <Primitive.Content className={cn(dialogVariants({ size }), className)}>
          <div className="dialog-heading">
            <div>
              <Primitive.Title>{title}</Primitive.Title>
              <Primitive.Description
                className={description ? "muted" : "sr-only"}
              >
                {description || title}
              </Primitive.Description>
            </div>
            <Primitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close dialog">
                <X size={18} />
              </Button>
            </Primitive.Close>
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
