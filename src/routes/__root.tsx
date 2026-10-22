import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { logSessionEvent } from "@/lib/session-audit.functions";
import { clearSessionActivity, createSessionTransitionTracker, markSessionActivity, sessionIdentity } from "@/lib/session-activity";
import { SessionEmailContext } from "@/components/session-context";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fisio App — Controle de Atendimentos" },
      { name: "description", content: "Controle de atendimentos: cadastro, dashboard e exportação para Excel." },
      { name: "author", content: "Fisio App" },
      { property: "og:title", content: "Fisio App — Controle de Atendimentos" },
      { property: "og:description", content: "Controle de atendimentos: cadastro, dashboard e exportação para Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Fisio App — Controle de Atendimentos" },
      { name: "twitter:description", content: "Controle de atendimentos: cadastro, dashboard e exportação para Excel." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const logSession = useServerFn(logSessionEvent);
  const logSessionRef = useRef(logSession);
  logSessionRef.current = logSession;
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const isNewLogin = createSessionTransitionTracker();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null);
      const freshLogin = isNewLogin(event, session ? sessionIdentity(session.access_token) : null);
      if (freshLogin) {
        markSessionActivity();
        // Auth callbacks run under the auth lock; defer RPC work until it is released.
        setTimeout(() => {
          void logSessionRef.current({ data: { action: "LOGIN" } }).catch(() => {});
        }, 0);
      }
      if (event === "SIGNED_OUT") clearSessionActivity();
      if (event === "SIGNED_OUT" || event === "USER_UPDATED" || freshLogin) {
        setTimeout(() => {
          void router.invalidate();
          if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
        }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionEmailContext.Provider value={email}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
      </SessionEmailContext.Provider>
    </QueryClientProvider>
  );
}
