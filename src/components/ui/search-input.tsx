import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Input } from "./input";

const searchVariants = cva("search-input", {
  variants: { variant: { default: "", command: "command-input" } },
  defaultVariants: { variant: "default" },
});
type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "aria-label" | "value" | "onChange"
> &
  VariantProps<typeof searchVariants> & {
    label: string;
    value: string;
    onValueChange: (value: string) => void;
  };

export function SearchInput({
  label,
  value,
  onValueChange,
  variant,
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn(searchVariants({ variant }), className)}>
      <Search aria-hidden="true" size={variant === "command" ? 18 : 16} />
      <Input
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
    </div>
  );
}
