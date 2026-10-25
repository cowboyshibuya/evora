import { createFileRoute, notFound } from "@tanstack/react-router";
import type { Page } from "@/lib/types";
import { WorkspaceApp } from "@/components/workspace-app";
const pages = [
  "overview",
  "transactions",
  "invoices",
  "calendar",
  "documents",
  "notes",
  "contacts",
  "reports",
  "settings",
];
export const Route = createFileRoute("/$page")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!pages.includes(params.page)) throw notFound();
  },
  component: PageRoute,
});
function PageRoute() {
  const { page } = Route.useParams();
  return <WorkspaceApp page={page as Page} />;
}
