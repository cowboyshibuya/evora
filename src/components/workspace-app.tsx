import { canEditRecords } from "@/lib/permissions";
import { SearchInput } from "./ui/search-input";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ArrowUpRight,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  CircleHelp,
  Command,
  Download,
  FileText,
  FolderClosed,
  GitBranch,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  StickyNote,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { WorkspaceContext } from "@/lib/workspace-context";
import { cn, today } from "@/lib/utils";
import type { Entry, EntryInput, Kind, Page, Workspace } from "@/lib/types";
import { Avatar, Empty, Loading, Logo } from "./common";
import { invoiceStatus } from "@/lib/invoices";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Dialog } from "./ui/dialog";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "./ui/dropdown-menu";
import { CompanyDialog } from "./company-dialog";
import { CompanyAvatar } from "./company-logo";
import { QuickAddMenu, Shortcut } from "./quick-add-menu";
import { QUICK_ACTIONS } from "@/lib/quick-actions";
import { useWorkspaceHotkeys } from "@/hooks/use-workspace-hotkeys";
import { RecordEditor } from "./record-editor";
import { InvoiceDetail } from "./invoice-detail";
import { ExportDialog } from "./export-dialog";
import { Overview } from "./overview";
import { Transactions } from "./transactions";
import { Invoices } from "./invoices";
import { Calendar } from "./calendar";
import { Documents } from "./documents";
import { Notes } from "./notes";
import { Contacts } from "./contacts";
import { Reports } from "./reports";
import { Settings } from "./settings";

const navigation = [
  {
    page: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Workspace",
  },
  {
    page: "transactions",
    label: "Transactions",
    icon: ArrowDownUp,
    group: "Finance",
  },
  { page: "invoices", label: "Invoices", icon: FileText, group: "Finance" },
  { page: "reports", label: "Reports", icon: TrendingUp, group: "Finance" },
  { page: "calendar", label: "Calendar", icon: CalendarDays, group: "Company" },
  {
    page: "documents",
    label: "Documents",
    icon: FolderClosed,
    group: "Company",
  },
  { page: "notes", label: "Notes", icon: StickyNote, group: "Company" },
  { page: "contacts", label: "Contacts", icon: Users, group: "Company" },
] as const;
const kindPage: Record<Kind, Page> = {
  transaction: "transactions",
  invoice: "invoices",
  event: "calendar",
  document: "documents",
  note: "notes",
  contact: "contacts",
};

async function loadWorkspace(companyId?: string): Promise<Workspace> {
  let workspace: Workspace;
  try {
    workspace = await api<Workspace>("workspace", undefined, companyId);
  } catch (error) {
    const status = (error as { status: number }).status;
    if (status === 403) return api<Workspace>("workspace");
    if (status !== 401) throw error;
    const invitation = new URLSearchParams(window.location.search).get(
      "invite",
    );
    if (invitation) {
      window.location.href = `/auth?invite=${encodeURIComponent(invitation)}`;
      throw new Error("Sign in to accept your invitation.");
    }
    if (localStorage.getItem("evora:signed-in")) {
      window.location.href = "/auth";
      throw new Error("Your session has expired. Please sign in again.");
    }
    const result = await authClient.signIn.anonymous();
    if (result.error)
      throw new Error(
        result.error.message || "Unable to open the demo workspace.",
      );
    await api("demo", { method: "POST" });
    workspace = await api<Workspace>("workspace");
  }
  if (workspace.user.isAnonymous && !workspace.companies.length) {
    await api("demo", { method: "POST" });
    return api<Workspace>("workspace");
  }
  return workspace;
}

export function WorkspaceApp({ page = "overview" }: { page?: Page }) {
  const navigate = useNavigate(),
    client = useQueryClient(),
    [companyId, setCompanyId] = useState<string>(),
    [initialized, setInitialized] = useState(false);
  const [mobileNav, setMobileNav] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(""),
    [help, setHelp] = useState(false),
    [companyDialog, setCompanyDialog] = useState(false);
  const [editor, setEditor] = useState<{
      kind: Kind;
      entry?: Entry;
      defaults?: Partial<EntryInput>;
    } | null>(null),
    [invoice, setInvoice] = useState<Entry | null>(null),
    [deleting, setDeleting] = useState<Entry | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false);
  const [exportOptions, setExportOptions] = useState<{
    kind: string;
    from: string;
    to: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    invitationHandled = useRef(false),
    uploadDate = useRef<string | undefined>(undefined);
  useEffect(() => {
    setCompanyId(localStorage.getItem("evora:company") || undefined);
    setInitialized(true);
  }, []);
  const query = useQuery({
    queryKey: ["workspace", companyId],
    queryFn: () => loadWorkspace(companyId),
    enabled: initialized,
    retry: false,
  });
  const workspace = query.data;
  const reload = async () => {
    await client.invalidateQueries({ queryKey: ["workspace"] });
  };
  const switchCompany = (id: string) => {
    localStorage.setItem("evora:company", id);
    setCompanyId(id);
    setMobileNav(false);
    setEditor(null);
    setInvoice(null);
    setDeleting(null);
    setExportOptions(null);
  };
  useEffect(() => {
    setMobileNav(false);
  }, [page]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    if (!workspace || invitationHandled.current) return;
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token && workspace.user.isAnonymous) {
      window.location.href = `/auth?invite=${encodeURIComponent(token)}`;
      return;
    }
    if (token) {
      invitationHandled.current = true;
      api<{ companyId: string }>("invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
        .then(async (result) => {
          switchCompany(result.companyId);
          await reload();
          window.history.replaceState({}, "", window.location.pathname);
          toast.success("You’ve joined the company.");
        })
        .catch((e) => toast.error(e.message, { duration: Infinity }));
    }
  }, [workspace?.user.id]);
  useEffect(() => {
    if (workspace && !workspace.user.isAnonymous)
      localStorage.setItem("evora:signed-in", "1");
  }, [workspace?.user.id, workspace?.user.isAnonymous]);
  const canEdit = Boolean(canEditRecords(workspace?.company?.role));
  const saveEntry = async (entry: EntryInput, id?: string) => {
    try {
      await api(
        id ? `entries/${id}` : "entries",
        { method: id ? "PUT" : "POST", body: JSON.stringify(entry) },
        workspace!.company!.id,
      );
      await reload();
      toast.success(
        id
          ? "Changes saved."
          : entry.kind === "event"
            ? "Reminder added to your calendar."
            : `${entry.kind[0].toUpperCase() + entry.kind.slice(1)} added.`,
      );
    } catch (e) {
      throw e;
    }
  };
  const openEntry = (entry: Entry) => {
    if (entry.kind === "document") {
      const a = document.createElement("a");
      a.href = `/api/entries/${entry.id}/download?company=${workspace!.company!.id}`;
      a.download = entry.title;
      a.click();
      return;
    }
    if (entry.kind === "invoice") setInvoice(entry);
    else setEditor({ kind: entry.kind, entry });
  };
  const createEntry = (kind: Kind, defaults?: Partial<EntryInput>) => {
    if (canEdit) setEditor({ kind, defaults });
  };
  const quickAdd = (kind: Kind, date?: string) => {
    if (!canEdit || !workspace?.company) return;
    if (kind === "document") {
      uploadDate.current = date;
      fileInput.current?.click();
    } else createEntry(kind, date ? { date } : undefined);
  };
  useWorkspaceHotkeys({
    enabled: canEdit && Boolean(workspace?.company),
    scope: workspace?.company?.id,
    onAction: quickAdd,
  });
  const uploadFiles = async (
    files: File[],
    folder = "Company",
    date?: string,
  ) => {
    if (!files.length) return;
    const toastId = toast.loading(
      `Uploading ${files.length === 1 ? files[0].name : `${files.length} files`}…`,
    );
    let uploaded = 0;
    try {
      for (const file of files) {
        if (file.size > 20 * 1048576)
          throw new Error(`${file.name} is larger than 20 MB.`);
        const form = new FormData();
        form.append("file", file);
        form.append("folder", folder);
        if (date) form.append("date", date);
        await api(
          "upload",
          { method: "POST", body: form },
          workspace!.company!.id,
        );
        uploaded++;
      }
      await reload();
      toast.success(
        `${uploaded} ${uploaded === 1 ? "document" : "documents"} uploaded.`,
        { id: toastId },
      );
    } catch (e) {
      await reload();
      toast.error(
        `${(e as Error).message}${uploaded ? ` ${uploaded} files were uploaded successfully.` : ""}`,
        { id: toastId, duration: Infinity },
      );
    }
  };
  const signOut = async () => {
    await authClient.signOut();
    client.clear();
    localStorage.removeItem("evora:company");
    window.location.href = "/auth";
  };
  if (!initialized || query.isPending) return <Loading />;
  if (query.error || !workspace)
    return (
      <div className="app-loading">
        <Logo />
        <h1>Unable to load your workspace</h1>
        <p>{query.error?.message || "Please try again."}</p>
        <Button onClick={() => query.refetch()}>Try again</Button>
        <a href="/auth">Sign in to Evora</a>
      </div>
    );
  const overdueCount = workspace.entries.filter(
    (e) => e.kind === "invoice" && invoiceStatus(e) === "overdue",
  ).length;
  const notifications = workspace.entries
    .filter(
      (e) =>
        (e.kind === "invoice" && invoiceStatus(e) === "overdue") ||
        (e.kind === "event" &&
          e.status === "pending" &&
          e.date <= formatFutureDate(7)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const searchResults = search.trim()
    ? workspace.entries
        .filter((e) =>
          `${e.title} ${e.category} ${JSON.stringify(e.data)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 12)
    : [];
  const topLabel =
    page === "settings"
      ? "Settings"
      : navigation.find((n) => n.page === page)?.label || "Overview";
  const views = {
      overview: Overview,
      transactions: Transactions,
      invoices: Invoices,
      calendar: Calendar,
      documents: Documents,
      notes: Notes,
      contacts: Contacts,
      reports: Reports,
      settings: Settings,
    },
    View = views[page];
  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        switchCompany,
        saveEntry,
        deleteEntry: setDeleting,
        openEntry,
        editEntry: (e) => setEditor({ kind: e.kind, entry: e }),
        createEntry,
        quickAdd,
        exportData: (kind = "all", from = "", to = "") =>
          setExportOptions({ kind, from, to }),
        uploadFiles,
        chooseFiles: () => {
          uploadDate.current = undefined;
          fileInput.current?.click();
        },
        reload,
        canEdit,
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="app-shell">
        {mobileNav && (
          <button
            className="mobile-nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          />
        )}
        <aside
          className={cn("sidebar", mobileNav && "sidebar-open")}
          aria-label="Main navigation"
        >
          <div className="sidebar-brand">
            <Link to="/" aria-label="Evora overview">
              <Logo />
            </Link>
            <Button
              className="mobile-close"
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              onClick={() => setMobileNav(false)}
            >
              <X size={18} />
            </Button>
          </div>
          <Dropdown
            align="start"
            className="company-dropdown"
            trigger={
              <button className="company-switcher" aria-label="Switch company">
                <CompanyAvatar
                  company={workspace.company}
                  className="company-monogram"
                />
                <span>
                  <strong>{workspace.company?.name || "Your company"}</strong>
                  <small>
                    {workspace.user.isAnonymous
                      ? "Demo workspace"
                      : "Company workspace"}
                  </small>
                </span>
                <ChevronsUpDown size={14} />
              </button>
            }
          >
            <DropdownLabel>Your companies</DropdownLabel>
            {workspace.companies.map((c) => (
              <DropdownItem key={c.id} onSelect={() => switchCompany(c.id)}>
                <CompanyAvatar company={c} className="company-mini-monogram" />
                {c.name}
                {c.id === workspace.company?.id && (
                  <Check size={15} className="ml-auto" />
                )}
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem onSelect={() => setCompanyDialog(true)}>
              <Plus size={16} />
              Add a company
            </DropdownItem>
          </Dropdown>
          <button
            className="sidebar-search"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={15} />
            <span>Search anything…</span>
            <kbd>⌘ K</kbd>
          </button>
          <nav className="sidebar-navigation">
            {navigation.map((item, i) => (
              <div key={item.page}>
                {(i === 0 || navigation[i - 1].group !== item.group) && (
                  <span className="nav-group-label">{item.group}</span>
                )}
                <Link
                  to={item.page === "overview" ? "/" : "/$page"}
                  params={item.page === "overview" ? {} : { page: item.page }}
                  className={cn("nav-item", page === item.page && "active")}
                  aria-current={page === item.page ? "page" : undefined}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {item.page === "invoices" && overdueCount > 0 && (
                    <span className="nav-count">{overdueCount}</span>
                  )}
                  {item.page === "overview" && (
                    <span className="nav-active-dot" />
                  )}
                </Link>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {workspace.user.isAnonymous && (
              <div className="demo-callout">
                <span className="demo-callout-icon">
                  <Building2 size={18} />
                </span>
                <strong>A little less admin.</strong>
                <p>Make space for the work you love.</p>
                <a href="/auth?mode=signup">
                  Make it your workspace
                  <ArrowUpRight size={13} />
                </a>
              </div>
            )}
            <Link
              to="/$page"
              params={{ page: "settings" }}
              className={cn("nav-item", page === "settings" && "active")}
            >
              <Settings2 size={17} />
              <span>Settings</span>
            </Link>
            <button
              className="nav-item help-button"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={17} />
              <span>Help & shortcuts</span>
              <span className="help-key">?</span>
            </button>
            <div className="sidebar-user">
              <Dropdown
                align="start"
                trigger={
                  <button className="user-menu-button">
                    <Avatar name={workspace.user.name} />
                    <span>
                      <strong>{workspace.user.name}</strong>
                      <small>
                        {workspace.user.isAnonymous
                          ? "Exploring Evora"
                          : workspace.user.email}
                      </small>
                    </span>
                    <ChevronsUpDown size={14} />
                  </button>
                }
              >
                <DropdownLabel>
                  {workspace.user.isAnonymous
                    ? "Explore your workspace"
                    : workspace.user.email}
                </DropdownLabel>
                {workspace.user.isAnonymous && (
                  <DropdownItem
                    onSelect={() => {
                      window.location.href = "/auth?mode=signup";
                    }}
                  >
                    <Plus size={15} />
                    Create your account
                  </DropdownItem>
                )}
                <DropdownItem
                  onSelect={() =>
                    navigate({ to: "/$page", params: { page: "settings" } })
                  }
                >
                  <Settings2 size={15} />
                  Account settings
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem onSelect={signOut}>
                  <LogOut size={15} />
                  {workspace.user.isAnonymous
                    ? "Sign in to your account"
                    : "Sign out"}
                </DropdownItem>
              </Dropdown>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <Button
                className="mobile-menu"
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                onClick={() => setMobileNav(true)}
              >
                <Menu size={19} />
              </Button>
              <Link to="/" className="breadcrumb-company">
                {workspace.company?.name || "Evora"}
              </Link>
              <span className="breadcrumb-slash">/</span>
              <span>{topLabel}</span>
            </div>
            <div className="topbar-actions">
              <span className="workspace-saved">
                <span className="live-dot" />
                {query.isFetching
                  ? "Updating workspace…"
                  : "Workspace up to date"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                aria-label="Search workspace"
              >
                <Search size={18} />
              </Button>
              <Dropdown
                className="notifications-dropdown"
                trigger={
                  <Button
                    className="notification-button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Notifications, ${notifications.length} items`}
                  >
                    <Bell size={18} />
                    {notifications.length > 0 && <i />}
                  </Button>
                }
              >
                <DropdownLabel>On your radar</DropdownLabel>
                {notifications.slice(0, 6).map((e) => (
                  <DropdownItem key={e.id} onSelect={() => openEntry(e)}>
                    <span
                      className={cn(
                        "notification-icon",
                        e.kind === "invoice" && "warning",
                      )}
                    >
                      {e.kind === "invoice" ? (
                        <FileText size={16} />
                      ) : (
                        <CalendarDays size={16} />
                      )}
                    </span>
                    <span>
                      <strong>{e.title}</strong>
                      <small>
                        {e.kind === "invoice"
                          ? "Invoice overdue"
                          : e.date < today()
                            ? "Reminder overdue"
                            : "Upcoming reminder"}{" "}
                        · {e.date}
                      </small>
                    </span>
                  </DropdownItem>
                ))}
                {!notifications.length && (
                  <span className="dropdown-empty">You’re all caught up.</span>
                )}
                <DropdownSeparator />
                <DropdownItem
                  onSelect={() =>
                    navigate({ to: "/$page", params: { page: "calendar" } })
                  }
                >
                  <CalendarDays size={15} />
                  Open your calendar
                </DropdownItem>
              </Dropdown>
              <Separator orientation="vertical" className="topbar-divider" />
              <QuickAddMenu />
            </div>
          </header>
          <main id="main-content" className="main-content">
            {workspace.company ? (
              <View />
            ) : (
              <div className="app-loading">
                <Building2 size={34} />
                <h1>Your next chapter starts here.</h1>
                <p>Create your first company to get started.</p>
              </div>
            )}
          </main>
        </div>
      </div>
      <input
        type="file"
        multiple
        ref={fileInput}
        className="sr-only"
        aria-label="Upload company documents"
        tabIndex={-1}
        onChange={(e) => {
          uploadFiles(
            Array.from(e.target.files || []),
            "Company",
            uploadDate.current,
          );
          uploadDate.current = undefined;
          e.target.value = "";
        }}
      />
      {(companyDialog ||
        (!workspace.company &&
          !new URLSearchParams(
            typeof window !== "undefined" ? window.location.search : "",
          ).has("invite"))) && (
        <CompanyDialog
          required={!workspace.company}
          onClose={() => setCompanyDialog(false)}
          onCreated={(id) => {
            switchCompany(id);
            setCompanyDialog(false);
            reload();
          }}
        />
      )}
      {editor && (
        <RecordEditor
          key={editor.entry?.id || editor.kind}
          {...editor}
          onClose={() => setEditor(null)}
        />
      )}
      {invoice && (
        <InvoiceDetail
          entry={workspace.entries.find((e) => e.id === invoice.id) || invoice}
          onClose={() => setInvoice(null)}
          onEdit={() => {
            setEditor({ kind: "invoice", entry: invoice });
            setInvoice(null);
          }}
        />
      )}
      {exportOptions && (
        <ExportDialog
          open
          onClose={() => setExportOptions(null)}
          workspace={workspace}
          initialKind={exportOptions.kind}
          initialFrom={exportOptions.from}
          initialTo={exportOptions.to}
        />
      )}
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete this ${deleting?.kind || "item"}?`}
        description="This permanently removes the item from this company."
      >
        <div className="dialog-body">
          <p className="delete-preview">{deleting?.title}</p>
          {deleting?.kind === "document" && (
            <p className="muted">The original file will also be deleted.</p>
          )}
        </div>
        <div className="dialog-footer">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Keep item
          </Button>
          <Button
            variant="destructive"
            disabled={deleteBusy}
            onClick={async () => {
              if (!deleting) return;
              setDeleteBusy(true);
              try {
                await api(
                  `entries/${deleting.id}`,
                  { method: "DELETE" },
                  workspace.company!.id,
                );
                await reload();
                setDeleting(null);
                toast.success("Item deleted.");
              } catch (e) {
                toast.error((e as Error).message, { duration: Infinity });
              } finally {
                setDeleteBusy(false);
              }
            }}
          >
            {deleteBusy && <Loader2 size={15} className="spin" />}Delete{" "}
            {deleting?.kind}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Find a little clarity"
        description="Search across this company’s finances, documents, notes, and plans."
        size="search"
      >
        <div className="dialog-body">
          <SearchInput
            variant="command"
            autoFocus
            placeholder="Search your company…"
            value={search}
            onValueChange={setSearch}
            label="Search all company records"
          />
          <div className="search-results">
            {search.trim() ? (
              searchResults.length ? (
                searchResults.map((entry) => (
                  <button
                    className="search-result"
                    key={entry.id}
                    onClick={() => {
                      setSearchOpen(false);
                      setSearch("");
                      navigate({
                        to: "/$page",
                        params: { page: kindPage[entry.kind] },
                      });
                      openEntry(entry);
                    }}
                  >
                    <span className="search-result-icon">
                      {entry.kind === "note" ? (
                        <StickyNote size={17} />
                      ) : entry.kind === "event" ? (
                        <CalendarDays size={17} />
                      ) : (
                        <FileText size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.kind} · {entry.category}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))
              ) : (
                <Empty
                  title={`No results for “${search}”`}
                  description="Try a client name, a document, or a word from a note."
                />
              )
            ) : (
              <>
                <span className="dropdown-label">Go to</span>
                {navigation.map((item) => (
                  <button
                    className="search-result"
                    key={item.page}
                    onClick={() => {
                      navigate({ to: "/$page", params: { page: item.page } });
                      setSearchOpen(false);
                    }}
                  >
                    <item.icon size={17} />
                    <span>{item.label}</span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        <div className="search-footer">
          <span>
            <kbd>esc</kbd> to close
          </span>
          <span>Searching {workspace.company?.name}</span>
        </div>
      </Dialog>
      <Dialog
        open={help}
        onOpenChange={setHelp}
        title="A little help, whenever you need it."
        description="Evora brings your company’s everyday work into one place."
      >
        <div className="dialog-body help-content">
          <div>
            <Command size={19} />
            <span>
              <strong>Find anything</strong>
              <p>Press ⌘ K or Ctrl K to search this company.</p>
            </span>
            <kbd>⌘ K</kbd>
          </div>
          <div>
            <Building2 size={19} />
            <span>
              <strong>Switch companies</strong>
              <p>
                Select the company name in the sidebar. Each company has its own
                records, files, and team.
              </p>
            </span>
          </div>
          <div>
            <Download size={19} />
            <span>
              <strong>Take your work with you</strong>
              <p>
                Export a period, a collection, or a complete archive from any
                screen.
              </p>
            </span>
          </div>
          <div>
            <GitBranch size={19} />
            <span>
              <strong>Open source. Yours to keep.</strong>
              <p>
                Evora is licensed under AGPL-3.0. Built with TanStack Start,
                Cloudflare D1 & R2, Tailwind CSS, and shadcn/ui.
              </p>
            </span>
          </div>
          <section className="help-shortcuts">
            <h3>Quick add shortcuts</h3>
            <p>
              Press N, then the next key. Shortcuts pause while you’re typing.
            </p>
            <dl>
              {QUICK_ACTIONS.map((action) => (
                <div key={action.kind}>
                  <dt>{action.label}</dt>
                  <dd>
                    <Shortcut second={action.key} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          {workspace.user.isAnonymous && (
            <p className="demo-help">
              You’re exploring an isolated demo workspace with sample data.
              Create an account to start your own company.
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <Button variant="outline" onClick={() => setHelp(false)}>
            Got it
          </Button>
        </div>
      </Dialog>
    </WorkspaceContext.Provider>
  );
}
function formatFutureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
