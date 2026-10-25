import { SearchInput } from "./ui/search-input";
import { DataTable } from "./ui/data-table";
import { useState } from "react";
import {
  Download,
  Folder,
  FolderOpen,
  Grid2X2,
  List,
  Plus,
  UploadCloud,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { cn, readableSize, shortDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Empty, FileIcon, PageHeader, RecordMenu } from "./common";

export function Documents() {
  const {
      workspace,
      openEntry,
      editEntry,
      deleteEntry,
      exportData,
      uploadFiles,
      chooseFiles,
      canEdit,
    } = useWorkspace(),
    [query, setQuery] = useState(""),
    [folder, setFolder] = useState("all"),
    [view, setView] = useState("grid"),
    [dragging, setDragging] = useState(false);
  const documents = workspace.entries.filter((e) => e.kind === "document"),
    folders = [
      ...new Set([
        "Company",
        "Finance",
        "Contracts",
        "Receipts",
        ...documents.map((e) => e.category),
      ]),
    ],
    filtered = documents.filter(
      (e) =>
        (folder === "all" || e.category === folder) &&
        e.title.toLowerCase().includes(query.toLowerCase()),
    );
  const drop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!canEdit) return;
    await uploadFiles(
      Array.from(e.dataTransfer.files),
      folder === "all" ? "Company" : folder,
    );
  };
  return (
    <>
      <PageHeader
        title="Everything has a home here."
        actions={
          <>
            <Button variant="outline" onClick={() => exportData("document")}>
              <Download size={15} />
              Export documents
            </Button>
            <Button disabled={!canEdit} onClick={chooseFiles}>
              <Plus size={16} />
              Upload document
            </Button>
          </>
        }
      />
      <div className="folder-grid">
        <button
          onClick={() => setFolder("all")}
          className={cn("folder-card", folder === "all" && "active")}
        >
          <span className="folder-icon">
            <FolderOpen size={22} />
          </span>
          <span>
            <strong>All documents</strong>
            <small>{documents.length} files</small>
          </span>
        </button>
        {folders.slice(0, 4).map((name) => (
          <button
            key={name}
            onClick={() => setFolder(name)}
            className={cn("folder-card", folder === name && "active")}
          >
            <span className="folder-icon">
              <Folder size={22} />
            </span>
            <span>
              <strong>{name}</strong>
              <small>
                {documents.filter((d) => d.category === name).length} files
              </small>
            </span>
          </button>
        ))}
      </div>
      <div
        className={cn("upload-zone", dragging && "dragging")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <span className="upload-icon">
          <UploadCloud size={23} />
        </span>
        <div>
          <strong>
            Drop your documents here, or{" "}
            <button disabled={!canEdit} onClick={chooseFiles}>
              browse files
            </button>
          </strong>
          <p>PDFs, spreadsheets, images, and more. Up to 20 MB per file.</p>
        </div>
      </div>
      <div className="section-heading documents-heading">
        <h2>
          {folder === "all" ? "All documents" : folder}
          <span className="tab-count">{filtered.length}</span>
        </h2>
        <div className="document-controls">
          <SearchInput
            label="Search documents"
            placeholder="Search documents…"
            value={query}
            onValueChange={setQuery}
          />
          <div className="view-toggle">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              <Grid2X2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="List view"
              aria-pressed={view === "list"}
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <List size={17} />
            </Button>
          </div>
        </div>
      </div>
      {view === "grid" ? (
        <div className="document-grid">
          {filtered.map((doc) => (
            <article className="document-card" key={doc.id}>
              <div className="document-card-top">
                <span className="category-badge">{doc.category}</span>
                {canEdit && (
                  <RecordMenu
                    onEdit={() => editEntry(doc)}
                    onDelete={() => deleteEntry(doc)}
                  />
                )}
              </div>
              <button
                className="document-preview"
                onClick={() => openEntry(doc)}
                aria-label={`Download ${doc.title}`}
              >
                <div className="paper-preview">
                  <div />
                  <div />
                  <strong>{doc.title.replace(/\.[^.]+$/, "")}</strong>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <FileIcon name={doc.title} />
                </div>
              </button>
              <div className="document-info">
                <button onClick={() => openEntry(doc)}>
                  <strong title={doc.title}>{doc.title}</strong>
                  <span>
                    {readableSize(Number(doc.data.size))} <i>·</i>{" "}
                    {shortDate(doc.date, "dd MMM yyyy")}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEntry(doc)}
                  aria-label={`Download ${doc.title}`}
                >
                  <Download size={16} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <DataTable
          containerClassName="panel"
          rows={filtered}
          rowKey={(doc) => doc.id}
          columns={[
            {
              id: "name",
              header: "Name",
              cell: (doc) => (
                <button className="client-cell" onClick={() => openEntry(doc)}>
                  <FileIcon name={doc.title} />
                  <strong>{doc.title}</strong>
                </button>
              ),
            },
            {
              id: "folder",
              header: "Folder",
              cell: (doc) => doc.category,
            },
            {
              id: "added",
              header: "Added",
              cell: (doc) => shortDate(doc.date),
            },
            {
              id: "size",
              header: "Size",
              cell: (doc) => readableSize(Number(doc.data.size)),
            },
            {
              id: "actions",
              header: null,
              cell: (doc) => (
                <div className="row-actions">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${doc.title}`}
                    onClick={() => openEntry(doc)}
                  >
                    <Download size={15} />
                  </Button>
                  {canEdit && (
                    <RecordMenu
                      onEdit={() => editEntry(doc)}
                      onDelete={() => deleteEntry(doc)}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      {!filtered.length && (
        <Empty
          title={
            query
              ? `No documents for “${query}”`
              : "Make room for your documents"
          }
          description="Upload a file to keep everything in one place."
          action={
            <Button variant="outline" disabled={!canEdit} onClick={chooseFiles}>
              <Plus size={15} />
              Upload a document
            </Button>
          }
        />
      )}
    </>
  );
}
