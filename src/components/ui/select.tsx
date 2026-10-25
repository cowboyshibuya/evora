import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./input";
export function Select({
  value,
  onValueChange,
  options,
  label,
  className,
  placeholder = "Select an option",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly (string | { value: string; label: string })[];
  label: string;
  className?: string;
  placeholder?: string;
}) {
  const field = useFieldControl();
  return (
    <Primitive.Root value={value} onValueChange={onValueChange}>
      <Primitive.Trigger
        id={field?.id}
        aria-describedby={field?.hintId}
        aria-label={label}
        className={cn("input select-trigger", className)}
      >
        <Primitive.Value placeholder={placeholder} />
        <Primitive.Icon>
          <ChevronDown size={14} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={5}
          className="select-content"
        >
          <Primitive.Viewport>
            {options.map((item) => {
              const option =
                typeof item === "string" ? { label: item, value: item } : item;
              return (
                <Primitive.Item
                  className="select-item"
                  key={option.value}
                  value={option.value}
                >
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator>
                    <Check size={14} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              );
            })}
          </Primitive.Viewport>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
