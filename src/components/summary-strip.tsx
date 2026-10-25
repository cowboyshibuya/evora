import type { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, money } from "@/lib/utils";

const summaryVariants = cva("summary-strip", {
  variants: { columns: { three: "", four: "four" } },
  defaultVariants: { columns: "three" },
});
interface SummaryItem {
  label: string;
  amount: number;
  icon?: LucideIcon;
  tone?: "income" | "danger";
}
export function SummaryStrip({
  items,
  currency,
  columns,
}: { items: SummaryItem[]; currency?: string } & VariantProps<
  typeof summaryVariants
>) {
  return (
    <div className={cn(summaryVariants({ columns }))}>
      {items.map(({ label, amount, icon: Icon, tone }) => (
        <div key={label}>
          <span>
            {Icon && <Icon size={16} />}
            {label}
          </span>
          <strong className={tone}>{money(amount, currency)}</strong>
        </div>
      ))}
    </div>
  );
}
