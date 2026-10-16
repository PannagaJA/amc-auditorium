import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum([
  "admin",
  "approver",
  "staff",
  "principal",
  "vice_principal",
  "dean_academics",
  "dean_student_affairs",
  "hod",
  "facilities_officer",
  "event_manager",
  "faculty",
  "associate_professor",
  "assistant_professor",
  "technical_staff",
  "placement_officer",
  "sports_director",
  "club_coordinator",
  "av_technician",
]);

function mapToAppRole(role: string): "admin" | "approver" | "staff" {
  if (role === "admin" || role === "facilities_officer") return "admin";
  if (
    role === "principal" ||
    role === "vice_principal" ||
    role === "dean_academics" ||
    role === "dean_student_affairs" ||
    role === "hod" ||
    role === "approver"
  ) {
    return "approver";
  }
  return "staff";
}

function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function hasValidServiceKey(): boolean {
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) return false;
  const trimmed = key.trim();
  if (
    trimmed === "" ||
    trimmed.includes("your_service_role") ||
    trimmed.includes("placeholder") ||
    trimmed.includes("secret_key_here")
  ) {
    return false;
  }
  return true;
}

async function assertAdmin(
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Only administrators can perform this action");
}

const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().max(20).optional().default(""),
  department_id: z.string().nullable().optional(),
  department_name: z.string().optional(),
  role: roleEnum,
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const appRole = mapToAppRole(data.role);

    let validDeptUuid = isValidUuid(data.department_id) ? data.department_id : null;

    const hasServiceKey = hasValidServiceKey();

    if (!hasServiceKey) {
      const localId = crypto.randomUUID();
      return {
        id: localId,
        localOnly: true,
        user: {
          id: localId,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone || null,
          role: appRole,
          collegeRole: data.role,
          department_id: validDeptUuid,
          department_name: data.department_name ?? null,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (
      !validDeptUuid &&
      data.department_name &&
      data.department_name !== "General Administration"
    ) {
      try {
        const { data: existingDept } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("name", data.department_name)
          .maybeSingle();

        if (existingDept) {
          validDeptUuid = existingDept.id;
        } else {
          const { data: newDept } = await supabaseAdmin
            .from("departments")
            .insert({ name: data.department_name })
            .select("id")
            .maybeSingle();
          if (newDept) validDeptUuid = newDept.id;
        }
      } catch (err) {
        console.warn("Could not insert/resolve department in DB:", err);
      }
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        department_id: validDeptUuid ?? "",
        department_name: data.department_name ?? "",
        college_role: data.role,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: appRole });
    if (rErr) throw new Error(rErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.created",
      entity: "user",
      entity_id: created.user.id,
      details: { email: data.email, role: data.role, appRole, department: data.department_name },
    });
    return { id: created.user.id };
  });

const updateUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().default(""),
  department_id: z.string().nullable().optional(),
  department_name: z.string().optional(),
  role: roleEnum,
  is_active: z.boolean(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => updateUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const appRole = mapToAppRole(data.role);

    if (data.id === context.userId && (appRole !== "admin" || !data.is_active)) {
      throw new Error("You cannot remove your own admin access or deactivate yourself");
    }

    let validDeptUuid = isValidUuid(data.department_id) ? data.department_id : null;
    const hasServiceKey = hasValidServiceKey();

    if (!hasServiceKey) {
      try {
        await context.supabase
          .from("profiles")
          .update({
            full_name: data.full_name,
            phone: data.phone,
            department_id: validDeptUuid,
            is_active: data.is_active,
          })
          .eq("id", data.id);
      } catch {
        // Ignored for local users
      }
      return {
        ok: true,
        localOnly: true,
        user: {
          id: data.id,
          full_name: data.full_name,
          phone: data.phone || null,
          role: appRole,
          collegeRole: data.role,
          department_id: validDeptUuid,
          department_name: data.department_name ?? null,
          is_active: data.is_active,
        },
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (
      !validDeptUuid &&
      data.department_name &&
      data.department_name !== "General Administration"
    ) {
      try {
        const { data: existingDept } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("name", data.department_name)
          .maybeSingle();

        if (existingDept) {
          validDeptUuid = existingDept.id;
        } else {
          const { data: newDept } = await supabaseAdmin
            .from("departments")
            .insert({ name: data.department_name })
            .select("id")
            .maybeSingle();
          if (newDept) validDeptUuid = newDept.id;
        }
      } catch (err) {
        console.warn("Could not insert/resolve department in DB:", err);
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone,
        department_id: validDeptUuid,
        is_active: data.is_active,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role: appRole });
    if (rErr) throw new Error(rErr.message);

    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.is_active ? "none" : "876000h",
      user_metadata: {
        college_role: data.role,
        phone: data.phone,
        full_name: data.full_name,
        department_id: validDeptUuid ?? "",
        department_name: data.department_name ?? "",
      },
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.updated",
      entity: "user",
      entity_id: data.id,
      details: {
        role: data.role,
        appRole,
        is_active: data.is_active,
        department: data.department_name,
      },
    });
    return { ok: true };
  });

export const hasAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const hasServiceKey = hasValidServiceKey();
  if (!hasServiceKey) return { hasAdmin: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { hasAdmin: (count ?? 0) > 0 };
});

const setupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

/** One-time bootstrap: only works while no admin exists. */
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => setupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Setup has already been completed");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, college_role: "admin" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create admin");

    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: created.user.id,
      action: "system.bootstrap_admin",
      entity: "user",
      entity_id: created.user.id,
      details: { email: data.email, full_name: data.full_name },
    });

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) {
      throw new Error("You cannot delete your own logged-in administrator account.");
    }

    const hasServiceKey = hasValidServiceKey();

    if (!hasServiceKey) {
      try {
        await context.supabase.from("profiles").delete().eq("id", data.id);
      } catch {
        // Ignored for local user
      }
      return { ok: true, localOnly: true, id: data.id };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch user details for audit
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.id)
      .maybeSingle();

    // Remove user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);

    // Remove profile
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);

    // Delete in auth.users
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) {
      // If foreign keys prevent hard auth deletion, disable permanently
      await supabaseAdmin.auth.admin.updateUserById(data.id, {
        ban_duration: "876000h",
        user_metadata: { is_active: false, deleted: true },
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user.deleted",
      entity: "user",
      entity_id: data.id,
      details: {
        deleted_email: targetProfile?.email,
        deleted_name: targetProfile?.full_name,
      },
    });

    return { ok: true };
  });

export const deleteVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const client = context.supabase;

    // Check if venue has pending or approved bookings
    const { data: activeBookings } = await client
      .from("bookings")
      .select("id, title, status")
      .eq("venue_id", data.id)
      .in("status", ["pending", "approved"]);

    if (activeBookings && activeBookings.length > 0) {
      throw new Error(
        `Cannot delete auditorium: it has ${activeBookings.length} active (pending or approved) booking(s). Please cancel or reassign them first, or set status to Inactive.`,
      );
    }

    const { data: venue } = await client
      .from("venues")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();

    // Delete any past/cancelled bookings to satisfy foreign keys
    await client.from("bookings").delete().eq("venue_id", data.id);

    const { error } = await client.from("venues").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await client.from("audit_logs").insert({
      actor_id: context.userId,
      action: "venue.deleted",
      entity: "venue",
      entity_id: data.id,
      details: { name: venue?.name },
    });

    return { ok: true };
  });

const createBookingSchema = z.object({
  venue_id: z.string().uuid(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  purpose: z.string().trim().min(10, "Purpose must be at least 10 characters").max(1000),
  attendees: z.number().int().min(1, "Attendees must be at least 1"),
  facilities: z.array(z.string()).default([]),
  start_at: z.string(),
  end_at: z.string(),
  idempotency_key: z.string().optional(),
});

export const createBookingAtomic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => createBookingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const client = context.supabase;

    // 1. Idempotency: verify identical request was not submitted in the last 20 seconds
    const twentySecsAgo = new Date(Date.now() - 20000).toISOString();
    const { data: duplicate } = await client
      .from("bookings")
      .select("id, title, status")
      .eq("user_id", context.userId)
      .eq("venue_id", data.venue_id)
      .eq("start_at", data.start_at)
      .eq("end_at", data.end_at)
      .gte("created_at", twentySecsAgo)
      .maybeSingle();

    if (duplicate) {
      return {
        ok: true,
        bookingId: duplicate.id,
        message: "Booking request already received (idempotent).",
      };
    }

    // 2. Validate auditorium existence & capacity
    const { data: venue, error: vErr } = await client
      .from("venues")
      .select("id, name, capacity, status, open_time, close_time")
      .eq("id", data.venue_id)
      .single();

    if (vErr || !venue) throw new Error("Selected auditorium not found.");
    if (venue.status !== "active") throw new Error(`Auditorium is currently ${venue.status}.`);
    if (data.attendees > venue.capacity) {
      throw new Error(
        `Attendees (${data.attendees}) exceed auditorium capacity (${venue.capacity}).`,
      );
    }

    // 3. Concurrency & 30-min buffer check against approved events
    const bMinutes = 30 * 60 * 1000;
    const reqStart = new Date(data.start_at).getTime();
    const reqEndWithBuf = new Date(data.end_at).getTime() + bMinutes;

    const { data: approvedBookings } = await client
      .from("bookings")
      .select("id, title, start_at, end_at, status")
      .eq("venue_id", data.venue_id)
      .eq("status", "approved");

    for (const b of approvedBookings ?? []) {
      const bStart = new Date(b.start_at).getTime();
      const bEndWithBuf = new Date(b.end_at).getTime() + bMinutes;
      if (reqStart < bEndWithBuf && bStart < reqEndWithBuf) {
        throw new Error(
          `Slot conflict with confirmed event "${b.title}". A mandatory 30-minute buffer is required between bookings.`,
        );
      }
    }

    // 4. Insert booking
    const { data: inserted, error: insErr } = await client
      .from("bookings")
      .insert({
        user_id: context.userId,
        venue_id: data.venue_id,
        title: data.title,
        purpose: data.purpose,
        attendees: data.attendees,
        facilities: data.facilities,
        start_at: data.start_at,
        end_at: data.end_at,
        status: "pending",
      })
      .select("id")
      .single();

    if (insErr) throw new Error(insErr.message);

    return { ok: true, bookingId: inserted.id };
  });

const editBookingSchema = z.object({
  id: z.string().uuid(),
  venue_id: z.string().uuid(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  purpose: z.string().trim().min(10, "Purpose must be at least 10 characters").max(1000),
  attendees: z.number().int().min(1, "Attendees must be at least 1"),
  facilities: z.array(z.string()).default([]),
  start_at: z.string(),
  end_at: z.string(),
});

export const editBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => editBookingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const client = context.supabase;

    // Fetch existing booking
    const { data: existing, error: getErr } = await client
      .from("bookings")
      .select("*")
      .eq("id", data.id)
      .single();

    if (getErr || !existing) throw new Error("Booking not found.");

    // Check authority: user must be the requester or admin
    const { data: isAdmin } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (existing.user_id !== context.userId && !isAdmin) {
      throw new Error("You are not authorized to edit this booking.");
    }

    if (existing.status !== "pending") {
      throw new Error(
        `Only pending bookings can be edited (current status: ${existing.status}). For confirmed bookings, please cancel and re-book.`,
      );
    }

    // Check venue capacity
    const { data: venue } = await client
      .from("venues")
      .select("capacity, status")
      .eq("id", data.venue_id)
      .single();

    if (venue && data.attendees > venue.capacity) {
      throw new Error(`Attendees (${data.attendees}) exceed capacity (${venue.capacity}).`);
    }

    // Buffer conflict check against approved bookings (excluding itself)
    const bMinutes = 30 * 60 * 1000;
    const reqStart = new Date(data.start_at).getTime();
    const reqEndWithBuf = new Date(data.end_at).getTime() + bMinutes;

    const { data: approvedBookings } = await client
      .from("bookings")
      .select("id, title, start_at, end_at")
      .eq("venue_id", data.venue_id)
      .eq("status", "approved")
      .neq("id", data.id);

    for (const b of approvedBookings ?? []) {
      const bStart = new Date(b.start_at).getTime();
      const bEndWithBuf = new Date(b.end_at).getTime() + bMinutes;
      if (reqStart < bEndWithBuf && bStart < reqEndWithBuf) {
        throw new Error(
          `Slot conflict with confirmed event "${b.title}". A 30-minute buffer is required.`,
        );
      }
    }

    const { error: updErr } = await client
      .from("bookings")
      .update({
        venue_id: data.venue_id,
        title: data.title,
        purpose: data.purpose,
        attendees: data.attendees,
        facilities: data.facilities,
        start_at: data.start_at,
        end_at: data.end_at,
      })
      .eq("id", data.id);

    if (updErr) throw new Error(updErr.message);

    await client.from("audit_logs").insert({
      actor_id: context.userId,
      action: "booking.updated",
      entity: "booking",
      entity_id: data.id,
      details: { title: data.title },
    });

    return { ok: true };
  });

export const deleteBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const client = context.supabase;

    const { data: existing, error: getErr } = await client
      .from("bookings")
      .select("*")
      .eq("id", data.id)
      .single();

    if (getErr || !existing) throw new Error("Booking not found.");

    const { data: isAdmin } = await client.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (existing.user_id !== context.userId && !isAdmin) {
      throw new Error("You are not authorized to delete this booking.");
    }

    if (existing.status === "approved" && !isAdmin) {
      throw new Error(
        "Approved bookings cannot be deleted directly. Please cancel the booking first so the slot and buffer are released properly.",
      );
    }

    // Delete associated approvals / notifications
    await client.from("approvals").delete().eq("booking_id", data.id);
    await client.from("notifications").delete().eq("booking_id", data.id);

    const { error: delErr } = await client.from("bookings").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);

    await client.from("audit_logs").insert({
      actor_id: context.userId,
      action: "booking.deleted",
      entity: "booking",
      entity_id: data.id,
      details: { title: existing.title, status: existing.status },
    });

    return { ok: true };
  });
