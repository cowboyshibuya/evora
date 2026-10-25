import { SearchInput } from "./ui/search-input";
import { useState } from "react";
import { Download, Pin, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { download } from "@/lib/export";
import { shortDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Tabs } from "./ui/tabs";
import { Empty, PageHeader, RecordMenu } from "./common";
import { DropdownItem } from "./ui/dropdown-menu";

export function Notes() {
  const {
      workspace,
      createEntry,
      openEntry,
      saveEntry,
      deleteEntry,
      exportData,
      canEdit,
    } = useWorkspace(),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("all");
  const notes = workspace.entries.filter((e) => e.kind === "note"),
    categories = [...new Set(notes.map((e) => e.category))],
    filtered = notes
      .filter(
        (e) =>
          (tab === "all" ||
            (tab === "pinned" && e.data.pinned) ||
            e.category === tab) &&
          `${e.title} ${e.data.content || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.data.pinned)) - Number(Boolean(a.data.pinned)) ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
  return (
    <>
      <PageHeader
        title="For the things worth keeping."
        description="A thought, a meeting, a plan. Give it a little space."
        actions={
          <>
            <Button variant="outline" onClick={() => exportData("note")}>
              <Download size={15} />
              Export notes
            </Button>
            <Button disabled={!canEdit} onClick={() => createEntry("note")}>
              <Plus size={16} />
              Write a note
            </Button>
          </>
        }
      />
      <div className="notes-toolbar">
        <Tabs
          value={tab}
          onValueChange={setTab}
          label="Note collections"
          items={[
            { value: "all", label: "All notes", count: notes.length },
            { value: "pinned", label: "Pinned" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
        <SearchInput
          label="Search notes"
          placeholder="Find a thought…"
          value={query}
          onValueChange={setQuery}
        />
      </div>
      <div
        id="filter-results"
        role="tabpanel"
        aria-label="Notes"
        className="notes-grid"
      >
        {filtered.map((note) => (
          <article className="note-card" key={note.id}>
            <div className="note-card-top">
              <span className="category-badge">{note.category}</span>
              <div>
                {Boolean(note.data.pinned) && <Pin size={13} />}
                {canEdit && (
                  <RecordMenu
                    onEdit={() => openEntry(note)}
                    onDelete={() => deleteEntry(note)}
                    extra={
                      <>
                        <DropdownItem
                          onSelect={() =>
                            saveEntry(
                              {
                                ...note,
                                data: {
                                  ...note.data,
                                  pinned: !note.data.pinned,
                                },
                              },
                              note.id,
                            ).catch((e) =>
                              toast.error(e.message, { duration: Infinity }),
                            )
                          }
                        >
                          <Pin size={15} />
                          {note.data.pinned ? "Unpin note" : "Pin note"}
                        </DropdownItem>
                        <DropdownItem
                          onSelect={() => {
                            download(
                              `# ${note.title}\n\n${note.data.content || ""}`,
                              `${note.title.replace(/[/\\]/g, "_")}.md`,
                              "text/markdown",
                            );
                            toast.success("Note downloaded.");
                          }}
                        >
                          <Download size={15} />
                          Download Markdown
                        </DropdownItem>
                      </>
                    }
                  />
                )}
              </div>
            </div>
            <button className="note-content" onClick={() => openEntry(note)}>
              <h2>{note.title}</h2>
              <p>{String(note.data.content || "Start writing…")}</p>
            </button>
            <div className="note-card-footer">
              <span>
                Edited {shortDate(note.updatedAt.slice(0, 10), "dd MMM")}
              </span>
              <span>
                {
                  String(note.data.content || "")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean).length
                }{" "}
                words
              </span>
            </div>
          </article>
        ))}
        {canEdit && (
          <button className="new-note-card" onClick={() => createEntry("note")}>
            <Plus size={24} />
            <strong>A little space for a new thought</strong>
            <span>Write a note</span>
          </button>
        )}
      </div>
      {!filtered.length && query && (
        <Empty
          title={`No notes for “${query}”`}
          description="Try another word, or clear your search."
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      )}
    </>
  );
}
