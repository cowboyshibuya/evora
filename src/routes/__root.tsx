import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import styles from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Evora — A little more clarity for your company" },
      {
        name: "description",
        content:
          "Your finances, invoices, documents, and plans. One thoughtful, open source workspace for your company.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <div className="app-loading">
      <h1>This page has moved</h1>
      <a href="/">Go to your overview</a>
    </div>
  ),
});
function Root() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={client}>
          <Outlet />
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{ className: "evora-toast" }}
          />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
