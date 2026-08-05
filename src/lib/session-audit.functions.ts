import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  action: z.enum(["LOGIN", "LOGOUT"]),
});

export const logSessionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email =
      (context.claims as { email?: string } | null)?.email ??
      (await context.supabase.auth.getUser()).data.user?.email ??
      null;

    const { error } = await (supabaseAdmin as any).from("audit_logs").insert({
      user_id: context.userId,
      user_email: email,
      action: data.action,
      entity: "auth_session",
      entity_id: null,
      changes: { at: new Date().toISOString() },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
