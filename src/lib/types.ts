export type Kind =
  "transaction" | "invoice" | "event" | "note" | "contact" | "document";
export type Role = "owner" | "admin" | "member" | "viewer";
export interface Company {
  id: string;
  logoKey: string;
  name: string;
  industry: string;
  currency: string;
  country: string;
  email: string;
  address: string;
  taxId: string;
  fiscalMonth: number;
  role: Role;
}
export interface Entry {
  id: string;
  companyId: string;
  kind: Kind;
  title: string;
  date: string;
  amount: number;
  category: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface Workspace {
  user: { id: string; name: string; email: string; isAnonymous?: boolean };
  companies: Company[];
  company: Company | null;
  entries: Entry[];
  members: { id: string; name: string; email: string; role: Role }[];
}
export type EntryInput = Omit<
  Entry,
  "id" | "companyId" | "createdAt" | "updatedAt"
>;
export type Page =
  | "overview"
  | "transactions"
  | "invoices"
  | "calendar"
  | "documents"
  | "notes"
  | "contacts"
  | "reports"
  | "settings";
export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}
