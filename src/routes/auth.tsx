import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";
export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});
