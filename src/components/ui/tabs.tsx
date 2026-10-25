import * as Primitive from "@radix-ui/react-tabs";
export function Tabs({
  value,
  onValueChange,
  items,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string; count?: number }[];
  label: string;
}) {
  return (
    <Primitive.Root value={value} onValueChange={onValueChange}>
      <Primitive.List className="tabs" aria-label={label}>
        {items.map((item) => (
          <Primitive.Trigger
            aria-controls="filter-results"
            className="tab"
            key={item.value}
            value={item.value}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="tab-count">{item.count}</span>
            )}
          </Primitive.Trigger>
        ))}
      </Primitive.List>
    </Primitive.Root>
  );
}
