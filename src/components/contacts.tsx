import { SearchInput } from "./ui/search-input";
import { DataTable, TableToolbar, TableFooter } from "./ui/data-table";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Avatar, Empty, PageHeader, RecordMenu } from "./common";

export function Contacts() {
  const {
      workspace,
      createEntry,
      openEntry,
      deleteEntry,
      exportData,
      canEdit,
    } = useWorkspace(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const contacts = workspace.entries.filter(
    (e) =>
      e.kind === "contact" &&
      (filter === "all" || e.category === filter) &&
      `${e.title} ${e.data.person} ${e.data.email}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="The people behind the work."
        description="Clients, partners, suppliers. Keep the right details close at hand."
        actions={
          <>
            <Button variant="outline" onClick={() => exportData("contact")}>
              <Download size={15} />
              Export
            </Button>
            <Button disabled={!canEdit} onClick={() => createEntry("contact")}>
              <Plus size={16} />
              Add contact
            </Button>
          </>
        }
      />
      <section className="panel full-table-panel">
        <TableToolbar>
          <SearchInput
            label="Search contacts"
            value={query}
            onValueChange={setQuery}
            placeholder="Search contacts…"
          />
          <Select
            label="Filter contacts"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All relationships" },
              "Client",
              "Supplier",
              "Partner",
              "Accountant",
              "Other",
            ]}
          />
        </TableToolbar>
        <DataTable
          rows={contacts}
          rowKey={(contact) => contact.id}
          columns={[
            {
              id: "company",
              header: "Company",
              cell: (contact) => (
                <button
                  className="client-cell"
                  onClick={() => openEntry(contact)}
                >
                  <Avatar name={contact.title} tone="party" />
                  <strong>{contact.title}</strong>
                </button>
              ),
            },
            {
              id: "person",
              header: "Contact person",
              cell: (contact) => String(contact.data.person || "—"),
            },
            {
              id: "email",
              header: "Email",
              cell: (contact) =>
                contact.data.email ? (
                  <a
                    className="email-link"
                    href={`mailto:${contact.data.email}`}
                  >
                    {String(contact.data.email)}
                  </a>
                ) : (
                  "—"
                ),
            },
            {
              id: "relationship",
              header: "Relationship",
              cell: (contact) => (
                <span className="category-badge">{contact.category}</span>
              ),
            },
            {
              id: "phone",
              header: "Phone",
              cell: (contact) => String(contact.data.phone || "—"),
              cellClassName: "muted",
            },
            {
              id: "actions",
              header: null,
              cell: (contact) =>
                canEdit && (
                  <RecordMenu
                    onEdit={() => openEntry(contact)}
                    onDelete={() => deleteEntry(contact)}
                  />
                ),
            },
          ]}
        />
        {!contacts.length && (
          <Empty
            title="Good work starts with good people"
            description="Add your first client, supplier, or partner."
            action={
              <Button
                variant="outline"
                disabled={!canEdit}
                onClick={() => createEntry("contact")}
              >
                <Plus size={15} />
                Add a contact
              </Button>
            }
          />
        )}
        <TableFooter>{contacts.length} contacts</TableFooter>
      </section>
    </>
  );
}
