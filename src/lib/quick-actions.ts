export const QUICK_ACTIONS = [
  { kind: "invoice", label: "Create invoice", key: "i" },
  { kind: "transaction", label: "Add transaction", key: "t" },
  { kind: "event", label: "Add reminder", key: "r" },
  { kind: "note", label: "Write a note", key: "n" },
  { kind: "contact", label: "Add contact", key: "c" },
  { kind: "document", label: "Upload document", key: "d" },
] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number]["kind"];
export const QUICK_ACTION_SEQUENCE_MS = 1200;
