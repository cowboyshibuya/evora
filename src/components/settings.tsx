import { CURRENCIES, FISCAL_MONTH_OPTIONS } from "@/lib/company-options";
import { canManageCompany } from "@/lib/permissions";
import { useEffect, useState } from "react";
import {
  Building2,
  Copy,
  Download,
  Laptop,
  Loader2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field, Input, Textarea } from "./ui/input";
import { Select } from "./ui/select";
import { Tabs } from "./ui/tabs";
import { Avatar, PageHeader, PanelHeading } from "./common";

export function Settings() {
  const [tab, setTab] = useState("company");
  return (
    <>
      <PageHeader
        title="Make yourself at home."
        description="Your company, your team, and the little details that make Evora yours."
      />
      <Tabs
        label="Settings sections"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: "company", label: "Company" },
          { value: "account", label: "My account" },
          { value: "team", label: "Team & access" },
          { value: "data", label: "Data & exports" },
        ]}
      />
      <div
        id="filter-results"
        role="tabpanel"
        aria-label="Settings"
        className="settings-content"
      >
        {tab === "company" ? (
          <CompanySettings />
        ) : tab === "account" ? (
          <AccountSettings />
        ) : tab === "team" ? (
          <TeamSettings />
        ) : (
          <DataSettings />
        )}
      </div>
    </>
  );
}
function CompanySettings() {
  const { workspace, reload } = useWorkspace(),
    company = workspace.company!,
    [values, setValues] = useState(company),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    canAdmin = canManageCompany(company.role);
  useEffect(() => {
    setValues(company);
  }, [company.id]);
  const update = (key: string, value: string | number) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <section className="panel settings-panel">
      <PanelHeading
        title="Company details"
        description="The details that appear on your invoices and exports."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              "company",
              { method: "PUT", body: JSON.stringify(values) },
              company.id,
            );
            await reload();
            toast.success("Company details updated.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={!canAdmin} className="settings-form">
          <div className="company-identity">
            <span className="settings-company-icon">
              <Building2 size={27} />
            </span>
            <div>
              <h3>{company.name}</h3>
              <p>{company.industry}</p>
            </div>
            <span className="category-badge">{company.role}</span>
          </div>
          <div className="form-grid">
            <Field label="Company name">
              <Input
                required
                minLength={2}
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="Industry">
              <Input
                value={values.industry}
                onChange={(e) => update("industry", e.target.value)}
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Company email">
              <Input
                type="email"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="VAT or tax number">
              <Input
                value={values.taxId}
                onChange={(e) => update("taxId", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Registered address">
            <Textarea
              rows={3}
              value={values.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Country">
              <Input
                required
                value={values.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </Field>
            <Field
              label="Currency"
              hint="Currency is fixed once financial records exist."
            >
              <Select
                label="Company currency"
                value={values.currency}
                onValueChange={(v) => update("currency", v)}
                options={CURRENCIES}
              />
            </Field>
          </div>
          <Field label="Financial year starts in">
            <Select
              label="Financial year start"
              value={String(values.fiscalMonth)}
              onValueChange={(v) => update("fiscalMonth", Number(v))}
              options={FISCAL_MONTH_OPTIONS}
            />
          </Field>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="settings-save">
            <Button disabled={busy || !canAdmin} type="submit">
              {busy && <Loader2 className="spin" size={15} />}Save company
              details
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
function AccountSettings() {
  const { workspace, reload } = useWorkspace(),
    [name, setName] = useState(workspace.user.name),
    [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<
      {
        token: string;
        userAgent?: string | null;
        createdAt: Date;
        expiresAt: Date;
      }[]
    >([]),
    session = authClient.useSession();
  const loadSessions = async () => {
    const result = await authClient.listSessions();
    if (result.data) setSessions(result.data);
  };
  useEffect(() => {
    if (!workspace.user.isAnonymous) loadSessions();
  }, []);
  return (
    <div className="settings-stack">
      <section className="panel settings-panel">
        <PanelHeading
          title="Your profile"
          description="A familiar face in your company’s workspace."
        />
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const result = await authClient.updateUser({ name });
            setBusy(false);
            if (result.error)
              toast.error(result.error.message, { duration: Infinity });
            else {
              await reload();
              toast.success("Profile updated.");
            }
          }}
        >
          <div className="profile-identity">
            <Avatar name={name} />
            <div>
              <strong>{workspace.user.name}</strong>
              <p>
                {workspace.user.isAnonymous
                  ? "Demo account"
                  : workspace.user.email}
              </p>
            </div>
          </div>
          <Field label="Full name">
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
          {!workspace.user.isAnonymous && (
            <Field label="Email">
              <Input value={workspace.user.email} disabled />
            </Field>
          )}
          <div className="settings-save">
            <Button disabled={busy}>Save profile</Button>
          </div>
        </form>
      </section>
      {workspace.user.isAnonymous ? (
        <section className="panel account-callout">
          <ShieldCheck size={25} />
          <div>
            <h2>A workspace of your own.</h2>
            <p>
              Create an account to securely manage your company, invite your
              team, and make a fresh start.
            </p>
            <Button asChild>
              <a href="/auth?mode=signup">Create your account</a>
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel settings-panel">
            <PanelHeading
              title="Sign-in & security"
              description="Your Google or GitHub account manages your password and account recovery."
            />
          </section>
          <section className="panel settings-panel">
            <PanelHeading
              title="Active sessions"
              description="Devices currently signed in to your account."
            />
            <div className="session-list">
              {sessions.map((s) => (
                <div className="session-item" key={s.token}>
                  <Laptop size={20} />
                  <div>
                    <strong>
                      {s.userAgent?.includes("Mobile")
                        ? "Mobile browser"
                        : "Desktop browser"}
                    </strong>
                    <small>
                      Signed in{" "}
                      {new Date(s.createdAt).toLocaleDateString("en-GB")}
                    </small>
                  </div>
                  {s.token === session.data?.session.token ? (
                    <span className="category-badge">This device</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await authClient.revokeSession({ token: s.token });
                        loadSessions();
                        toast.success("Session signed out.");
                      }}
                    >
                      Sign out
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function TeamSettings() {
  const { workspace, reload } = useWorkspace(),
    [invite, setInvite] = useState(false),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("member"),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState(""),
    [error, setError] = useState("");
  const canAdmin = canManageCompany(workspace.company!.role);
  return (
    <>
      <section className="panel settings-panel">
        <PanelHeading
          title="A good team makes all the difference."
          description={`${workspace.members.length} ${workspace.members.length === 1 ? "person" : "people"} in ${workspace.company?.name}.`}
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={!canAdmin || workspace.user.isAnonymous}
              onClick={() => {
                setInvite(true);
                setLink("");
                setError("");
              }}
            >
              <UserPlus size={15} />
              Invite someone
            </Button>
          }
        />
        <div className="team-members">
          {workspace.members.map((m) => (
            <div className="team-member" key={m.id}>
              <Avatar name={m.name} />
              <div>
                <strong>
                  {m.name}
                  {m.email === workspace.user.email && (
                    <span className="muted"> (you)</span>
                  )}
                </strong>
                <small>
                  {workspace.user.isAnonymous ? "Demo account" : m.email}
                </small>
              </div>
              {m.role === "owner" || !canAdmin ? (
                <span className="category-badge">{m.role}</span>
              ) : (
                <Select
                  label={`Role for ${m.name}`}
                  value={m.role}
                  onValueChange={async (value) => {
                    try {
                      await api(
                        `members/${m.id}`,
                        {
                          method: "PUT",
                          body: JSON.stringify({ role: value }),
                        },
                        workspace.company!.id,
                      );
                      await reload();
                      toast.success("Role updated.");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  options={["admin", "member", "viewer"]}
                />
              )}
              {canAdmin &&
                m.role !== "owner" &&
                m.email !== workspace.user.email && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (
                        !window.confirm(`Remove ${m.name} from this company?`)
                      )
                        return;
                      try {
                        await api(
                          `members/${m.id}`,
                          { method: "DELETE" },
                          workspace.company!.id,
                        );
                        await reload();
                        toast.success("Team member removed.");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
            </div>
          ))}
        </div>
        {workspace.user.isAnonymous && (
          <p className="settings-inline-note">
            Create an account to invite your team to your own workspace.
          </p>
        )}
      </section>
      <section className="panel roles-panel">
        <h2>The right level of access.</h2>
        <div>
          <span>
            <strong>Owner</strong>
            <p>Manages all company data, settings, and team members.</p>
          </span>
          <span>
            <strong>Admin</strong>
            <p>Manages records, company details, and team access.</p>
          </span>
          <span>
            <strong>Member</strong>
            <p>Creates and edits company records and documents.</p>
          </span>
          <span>
            <strong>Viewer</strong>
            <p>Views and exports records without changing them.</p>
          </span>
        </div>
      </section>
      <Dialog
        open={invite}
        onOpenChange={setInvite}
        title={
          link
            ? "An invitation, ready to share."
            : "Good work is better together."
        }
        description={
          link
            ? `An invitation has been prepared for ${email}. It expires in 7 days.`
            : `Invite someone to ${workspace.company?.name}.`
        }
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await api<{ url: string }>(
                "invitations",
                { method: "POST", body: JSON.stringify({ email, role }) },
                workspace.company!.id,
              );
              setLink(result.url);
              toast.success("Invitation link created.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="dialog-body">
            {link ? (
              <>
                <Field label="Invitation link">
                  <Input
                    readOnly
                    value={link}
                    onFocus={(e) => e.target.select()}
                  />
                </Field>
                <p className="muted">
                  Share this link with your teammate. Only someone signed in
                  with the verified email address {email} can accept it.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      toast.success("Invitation link copied.");
                    } catch {
                      setError(
                        "Unable to copy the link. Select it above and copy it manually.",
                      );
                    }
                  }}
                >
                  <Copy size={15} />
                  Copy invitation link
                </Button>
              </>
            ) : (
              <>
                <Field label="Email address">
                  <Input
                    autoFocus
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Role">
                  <Select
                    label="Invitation role"
                    value={role}
                    onValueChange={setRole}
                    options={[
                      {
                        value: "admin",
                        label: "Admin · manage company and team",
                      },
                      {
                        value: "member",
                        label: "Member · create and edit records",
                      },
                      {
                        value: "viewer",
                        label: "Viewer · view and export records",
                      },
                    ]}
                  />
                </Field>
                <p className="field-hint">
                  Create a link and share it with your teammate. Their Google or
                  GitHub account must use this email address.
                </p>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="dialog-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => setInvite(false)}
            >
              {link ? "Done" : "Cancel"}
            </Button>
            {!link && (
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 size={15} className="spin" />}Create
                invitation
              </Button>
            )}
          </div>
        </form>
      </Dialog>
    </>
  );
}
function DataSettings() {
  const { workspace, exportData } = useWorkspace();
  return (
    <div className="settings-stack">
      <section className="panel settings-panel">
        <PanelHeading
          title="Your data belongs to you."
          description="Export a single collection, a period, or everything. No lock-in."
        />
        <div className="settings-form">
          <div className="data-export-summary">
            <Download size={29} />
            <div>
              <strong>{workspace.entries.length} records</strong>
              <p>
                Across your finances, documents, notes, contacts, and calendar.
              </p>
            </div>
          </div>
          <Button onClick={() => exportData()}>
            <Download size={16} />
            Export company data
          </Button>
        </div>
      </section>
      <section className="panel roles-panel">
        <h2>Everything travels with you.</h2>
        <div>
          <span>
            <strong>Excel & CSV</strong>
            <p>
              Open your financial records in the spreadsheet app you prefer.
            </p>
          </span>
          <span>
            <strong>Original files & PDFs</strong>
            <p>
              A complete archive includes original documents and generated
              invoice PDFs.
            </p>
          </span>
          <span>
            <strong>Markdown & JSON</strong>
            <p>Your notes and structured records stay readable and portable.</p>
          </span>
          <span>
            <strong>Calendar</strong>
            <p>
              Bring reminders and invoice due dates into any calendar with an
              .ics export.
            </p>
          </span>
        </div>
      </section>
    </div>
  );
}
