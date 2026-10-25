import { createContext, useContext } from "react";
import type { Entry, EntryInput, Kind, Workspace } from "./types";

export interface WorkspaceContextValue {
  workspace: Workspace;
  switchCompany: (id: string) => void;
  saveEntry: (entry: EntryInput, id?: string) => Promise<void>;
  deleteEntry: (entry: Entry) => void;
  openEntry: (entry: Entry) => void;
  editEntry: (entry: Entry) => void;
  createEntry: (kind: Kind, defaults?: Partial<EntryInput>) => void;
  exportData: (kind?: string, from?: string, to?: string) => void;
  uploadFiles: (files: File[], folder?: string) => Promise<void>;
  chooseFiles: () => void;
  reload: () => Promise<void>;
  canEdit: boolean;
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace provider is missing.");
  return value;
}
