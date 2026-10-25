import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceApp } from "@/components/workspace-app";
export const Route = createFileRoute("/")({
  ssr: false,
  component: () => <WorkspaceApp />,
});
