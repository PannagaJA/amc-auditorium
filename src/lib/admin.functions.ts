import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "approver", "staff"]);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Only administrators can perform this action");
}

const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().max(20).optional().default(""),
  department_id: z.string().uuid().nullable().optional(),
  role: roleEnum,
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone, department_id: data.department_id ?? "" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.created",
      entity: "user",
      entity_id: created.user.id,
      details: { email: data.email, role: data.role },
    });
    return { id: created.user.id };
  });

const updateUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().default(""),
  department_id: z.string().uuid().nullable(),
  role: roleEnum,
  is_active: z.boolean(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId && (data.role !== "admin" || !data.is_active)) {
      throw new Error("You cannot remove your own admin access or deactivate yourself");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone, department_id: data.department_id, is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.is_active ? "none" : "876000h" });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.updated",
      entity: "user",
      entity_id: data.id,
      details: { role: data.role, is_active: data.is_active },
    });
    return { ok: true };
  });

export const hasAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return { hasAdmin: (count ?? 0) > 0 };
});

const setupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

/** One-time bootstrap: only works while no admin exists. */
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => setupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup has already been completed");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create admin");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { ok: true };
  });
