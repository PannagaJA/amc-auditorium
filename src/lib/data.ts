import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Role = Database["public"]["Enums"]["app_role"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];

export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  venues: { name: string; approver_id: string | null } | null;
  requester: { full_name: string; email: string } | null;
};

export const BOOKING_SELECT = "*, venues(name, approver_id), requester:profiles!bookings_user_id_fkey(full_name, email)";

export type Me = {
  id: string;
  email: string;
  profile: Profile & { departments: { name: string } | null };
  roles: Role[];
  role: Role | null;
  isAdmin: boolean;
  isApprover: boolean;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) return null;
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").eq("id", user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    if (p.error) throw p.error;
    const roles = (r.data ?? []).map((x) => x.role);
    const role: Role | null = roles.includes("admin") ? "admin" : roles.includes("approver") ? "approver" : roles.includes("staff") ? "staff" : null;
    return {
      id: user.id,
      email: user.email ?? "",
      profile: p.data as Me["profile"],
      roles,
      role,
      isAdmin: role === "admin",
      isApprover: role === "approver",
    };
  },
});

export function useMe() {
  const q = useQuery(meQuery);
  return q.data as Me;
}

export const venuesQuery = queryOptions({
  queryKey: ["venues"],
  queryFn: async () => {
    const { data, error } = await supabase.from("venues").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const departmentsQuery = queryOptions({
  queryKey: ["departments"],
  queryFn: async () => {
    const { data, error } = await supabase.from("departments").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export type UserRow = Profile & { departments: { name: string } | null; role: Role | null };

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: async (): Promise<UserRow[]> => {
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (p.error) throw p.error;
    const map = new Map<string, Role[]>();
    (r.data ?? []).forEach((x) => map.set(x.user_id, [...(map.get(x.user_id) ?? []), x.role]));
    return (p.data ?? []).map((u) => {
      const rs = map.get(u.id) ?? [];
      const role: Role | null = rs.includes("admin") ? "admin" : rs.includes("approver") ? "approver" : rs.includes("staff") ? "staff" : null;
      return { ...(u as UserRow), role };
    });
  },
});

export function bookingsRangeQuery(from: string, to: string) {
  return queryOptions({
    queryKey: ["bookings", "range", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .lt("start_at", to)
        .gt("end_at", from)
        .in("status", ["pending", "approved"])
        .order("start_at");
      if (error) throw error;
      return data as unknown as BookingRow[];
    },
  });
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  approver: "Principal / HOD",
  staff: "Staff",
};

export async function signedUrls(paths: string[]) {
  if (!paths.length) return [] as string[];
  const { data } = await supabase.storage.from("venue-photos").createSignedUrls(paths, 3600);
  return (data ?? []).map((d) => d.signedUrl ?? "");
}

export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ["photos", paths],
    queryFn: () => signedUrls(paths),
    staleTime: 30 * 60 * 1000,
    enabled: paths.length > 0,
  });
}
