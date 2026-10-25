import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
const FieldContext = createContext<{ id: string; hintId?: string } | null>(
  null,
);
export const useFieldControl = () => useContext(FieldContext);
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const field = useFieldControl();
  return (
    <input
      id={field?.id}
      aria-describedby={field?.hintId}
      className={cn("input", className)}
      {...props}
    />
  );
}
export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useFieldControl();
  return (
    <textarea
      id={field?.id}
      aria-describedby={field?.hintId}
      className={cn("input textarea", className)}
      {...props}
    />
  );
}
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <FieldContext.Provider
      value={{ id, hintId: hint ? `${id}-hint` : undefined }}
    >
      <div className={cn("field", className)}>
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {children}
        {hint && (
          <span id={`${id}-hint`} className="field-hint">
            {hint}
          </span>
        )}
      </div>
    </FieldContext.Provider>
  );
}
