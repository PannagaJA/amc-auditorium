import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Role = Database["public"]["Enums"]["app_role"]; // 'admin' | 'approver' | 'staff'
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type Venue = Database["public"]["Tables"]["venues"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];

export type CollegeRole =
  | "principal"
  | "vice_principal"
  | "dean_academics"
  | "dean_student_affairs"
  | "hod"
  | "admin"
  | "facilities_officer"
  | "event_manager"
  | "faculty"
  | "associate_professor"
  | "assistant_professor"
  | "technical_staff"
  | "placement_officer"
  | "sports_director"
  | "club_coordinator"
  | "av_technician"
  | "staff";

export interface CollegeRoleOption {
  value: CollegeRole;
  label: string;
  tier: Role;
  description: string;
}

export const COLLEGE_ROLES: CollegeRoleOption[] = [
  {
    value: "principal",
    label: "Principal",
    tier: "approver",
    description: "Chief Executive Authority — campus-wide auditorium review and sanction power",
  },
  {
    value: "vice_principal",
    label: "Vice Principal",
    tier: "approver",
    description: "Academic & Administrative Sanction Authority for auditorium bookings",
  },
  {
    value: "dean_academics",
    label: "Dean (Academics)",
    tier: "approver",
    description: "Sanction authority for institute-wide academic conferences & symposiums",
  },
  {
    value: "dean_student_affairs",
    label: "Dean (Student Affairs)",
    tier: "approver",
    description: "Approver for student club conventions, cultural fests & co-curricular programs",
  },
  {
    value: "hod",
    label: "Head of Department (HOD)",
    tier: "approver",
    description: "Departmental Authority — reviews & approves requests for departmental halls",
  },
  {
    value: "admin",
    label: "System Administrator (Admin)",
    tier: "admin",
    description: "Full administrative access to manage auditoriums, users, roles, and settings",
  },
  {
    value: "facilities_officer",
    label: "Campus Facilities & Estate Officer",
    tier: "admin",
    description: "Oversees physical venue infrastructure, maintenance downtime, and logistics",
  },
  {
    value: "event_manager",
    label: "Event Manager / Cultural Incharge",
    tier: "staff",
    description: "Coordinates college fests, symposiums, external guests, and cultural auditoriums",
  },
  {
    value: "faculty",
    label: "Professor / Senior Faculty",
    tier: "staff",
    description:
      "Can check live availability and schedule departmental academic seminars & guest lectures",
  },
  {
    value: "associate_professor",
    label: "Associate Professor",
    tier: "staff",
    description: "Organizes workshops, departmental seminars, research symposiums & presentations",
  },
  {
    value: "assistant_professor",
    label: "Assistant Professor",
    tier: "staff",
    description: "Conducts academic orientations, student seminars & departmental lectures",
  },
  {
    value: "technical_staff",
    label: "Lab Instructor / Technical Staff",
    tier: "staff",
    description: "Supports lab workshops, practical exams, coding hackathons & technical sessions",
  },
  {
    value: "placement_officer",
    label: "Training & Placement Officer (TPO)",
    tier: "staff",
    description: "Books auditoriums for campus recruitment drives, pre-placement talks & training",
  },
  {
    value: "sports_director",
    label: "Physical Education / Sports Director",
    tier: "staff",
    description: "Schedules indoor sports complexes, gymnasium events, and athletic meets",
  },
  {
    value: "club_coordinator",
    label: "Student Club / Society Coordinator",
    tier: "staff",
    description: "Schedules auditoriums for student technical clubs, IEEE, CSI & cultural fests",
  },
  {
    value: "av_technician",
    label: "AV & Acoustics / Sound Technician",
    tier: "staff",
    description: "Operates sound systems, stage lighting, projectors & AV streaming equipment",
  },
  {
    value: "staff",
    label: "Department Staff / Office Assistant",
    tier: "staff",
    description: "Can submit auditorium booking requests for departmental meetings and sessions",
  },
];

export const DEFAULT_DEPARTMENTS = [
  "General Administration",
  "Computer Science & Engineering (CSE)",
  "CSE - Artificial Intelligence & Machine Learning (CSE-AIML)",
  "Artificial Intelligence & Machine Learning (AIML)",
  "Artificial Intelligence & Data Science (AI & DS)",
  "Computer Science & Engineering - Cyber Security (CSE-CS)",
  "Computer Science & Engineering - Data Science (CSE-DS)",
  "Information Science & Engineering (ISE)",
  "Electronics & Communication Engineering (ECE)",
  "Electrical & Electronics Engineering (EEE)",
  "Mechanical Engineering (ME)",
  "Civil Engineering (Civil)",
  "Aeronautical Engineering (AE)",
  "Robotics & Automation",
  "Master of Business Administration (MBA)",
  "Master of Computer Applications (MCA)",
  "Basic Sciences & Humanities (BSH - Physics, Chemistry, Maths)",
  "Placement & Career Development Cell",
  "Physical Education & Sports Department",
  "Research & Development (R&D) & Innovation Cell",
  "Internal Quality Assurance Cell (IQAC)",
  "Examination Section / Controller of Examinations",
  "Admissions & Student Welfare",
  "Library & Information Resource Centre",
  "Campus Maintenance & Estate Facilities",
  "Accounts & Finance Department",
  "Principal / Dean Executive Office",
];

export function getTierForCollegeRole(role: CollegeRole | string): Role {
  const match = COLLEGE_ROLES.find((r) => r.value === role);
  if (match) return match.tier;
  if (role === "admin" || role === "facilities_officer") return "admin";
  if (
    role === "approver" ||
    role === "principal" ||
    role === "vice_principal" ||
    role === "dean_academics" ||
    role === "dean_student_affairs" ||
    role === "hod"
  ) {
    return "approver";
  }
  return "staff";
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "System Administrator",
  principal: "Principal",
  vice_principal: "Vice Principal",
  dean_academics: "Dean (Academics)",
  dean_student_affairs: "Dean (Student Affairs)",
  hod: "Head of Department (HOD)",
  approver: "Approver (Principal / HOD)",
  facilities_officer: "Facilities & Estate Officer",
  event_manager: "Event Manager / Cultural Incharge",
  faculty: "Professor / Senior Faculty",
  associate_professor: "Associate Professor",
  assistant_professor: "Assistant Professor",
  technical_staff: "Technical Staff / Lab Instructor",
  placement_officer: "Training & Placement Officer",
  sports_director: "Sports Director",
  club_coordinator: "Club / Society Coordinator",
  av_technician: "AV & Sound Technician",
  staff: "Department Staff",
};

export function getRoleBadgeStyle(role: string): {
  bg: string;
  text: string;
  border: string;
  tierLabel: string;
} {
  const adminRoles = ["admin", "facilities_officer"];
  const approverRoles = [
    "principal",
    "vice_principal",
    "dean_academics",
    "dean_student_affairs",
    "hod",
    "approver",
  ];

  if (adminRoles.includes(role)) {
    return {
      bg: "bg-purple-50",
      text: "text-purple-800",
      border: "border-purple-300",
      tierLabel: "Admin Tier",
    };
  }
  if (approverRoles.includes(role)) {
    return {
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-300",
      tierLabel: "Approver Tier",
    };
  }
  if (
    role === "faculty" ||
    role === "associate_professor" ||
    role === "assistant_professor" ||
    role === "placement_officer"
  ) {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-300",
      tierLabel: "Faculty / Academic",
    };
  }
  if (role === "event_manager" || role === "club_coordinator") {
    return {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-300",
      tierLabel: "Event Incharge",
    };
  }
  if (role === "technical_staff" || role === "av_technician") {
    return {
      bg: "bg-cyan-50",
      text: "text-cyan-800",
      border: "border-cyan-300",
      tierLabel: "Technical / AV",
    };
  }
  return {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-300",
    tierLabel: "Department Staff",
  };
}

export function getUserRoleCache(): Record<string, { role: string; department?: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("amc_user_roles_v2");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getLocalUsers(): UserRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("amc_local_users_v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalUser(user: UserRow) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalUsers();
    const filtered = current.filter((u) => u.id !== user.id);
    filtered.unshift(user);
    localStorage.setItem("amc_local_users_v1", JSON.stringify(filtered));
  } catch {
    // Ignore localStorage write failures
  }
}

export function deleteLocalUser(userId: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalUsers();
    const filtered = current.filter((u) => u.id !== userId);
    localStorage.setItem("amc_local_users_v1", JSON.stringify(filtered));
  } catch {
    // Ignore localStorage write failures
  }
}

export function saveUserRoleCache(
  userId: string | undefined | null,
  meta: { role: string; department?: string },
) {
  if (!userId || typeof window === "undefined") return;
  try {
    const existing = getUserRoleCache();
    existing[userId] = meta;
    localStorage.setItem("amc_user_roles_v2", JSON.stringify(existing));
  } catch {
    // Ignore localStorage write failures
  }
}

export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  venues: { name: string; approver_id: string | null; capacity: number; location: string } | null;
  requester: { full_name: string; email: string; phone: string | null } | null;
};

export const BOOKING_SELECT =
  "*, venues(name, approver_id, capacity, location), requester:profiles!bookings_user_id_fkey(full_name, email, phone)";

export type Me = {
  id: string;
  email: string;
  profile: Profile & { departments: { name: string } | null };
  roles: Role[];
  role: Role | null;
  collegeRole: CollegeRole | string;
  departmentName?: string | null;
  isAdmin: boolean;
  isApprover: boolean;
  isStaff: boolean;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) return null;
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("*, departments(name)").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    let profileData = p.data;

    // Self-healing: if the user authenticated but has no profile row yet, create it automatically
    if (!profileData) {
      try {
        const metaFullName =
          (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User";
        const metaPhone = (user.user_metadata?.phone as string) || null;
        const metaDeptId = (user.user_metadata?.department_id as string) || null;

        const { data: upserted } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email ?? "",
            full_name: metaFullName,
            phone: metaPhone,
            department_id: metaDeptId && metaDeptId.length === 36 ? metaDeptId : null,
            is_active: true,
          })
          .select("*, departments(name)")
          .maybeSingle();

        if (upserted) {
          profileData = upserted;
        }
      } catch (upsertErr) {
        console.warn("[meQuery] Could not auto-create profile row:", upsertErr);
      }
    }

    // Ultimate fallback object if table is completely missing or blocked
    if (!profileData) {
      profileData = {
        id: user.id,
        email: user.email ?? "",
        full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User",
        phone: (user.user_metadata?.phone as string) || null,
        department_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departments: null,
      } as unknown as Me["profile"];
    }

    const roles = (r.data ?? []).map((x) => x.role);
    const role: Role | null = roles.includes("admin")
      ? "admin"
      : roles.includes("approver")
        ? "approver"
        : roles.includes("staff")
          ? "staff"
          : null;
    const metaRole =
      (user.user_metadata?.college_role as string) ||
      (role === "admin" ? "admin" : role === "approver" ? "principal" : "staff");
    const metaDept = (user.user_metadata?.department_name as string) || null;

    return {
      id: user.id,
      email: user.email ?? "",
      profile: profileData as Me["profile"],
      roles,
      role,
      collegeRole: metaRole,
      departmentName:
        (profileData as { departments?: { name?: string } | null })?.departments?.name ||
        metaDept ||
        "General Administration",
      isAdmin: role === "admin",
      isApprover: role === "approver" || role === "admin",
      isStaff: role === "staff",
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

    const existing = data ?? [];
    const existingNames = new Set(existing.map((d) => d.name));

    // Try to auto-seed any missing default departments if user has admin rights
    const missing = DEFAULT_DEPARTMENTS.filter((n) => !existingNames.has(n));
    if (missing.length > 0) {
      try {
        const { data: inserted } = await supabase
          .from("departments")
          .insert(missing.map((name) => ({ name })))
          .select();
        if (inserted && inserted.length > 0) {
          return [...existing, ...inserted].sort((a, b) => a.name.localeCompare(b.name));
        }
      } catch {
        // If not permitted by RLS, we still show all departments in the UI by synthesizing stable objects
      }
    }

    // Merge any missing ones as selectable options
    const synthesized = missing.map((name, idx) => ({
      id: `fallback-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      name,
      created_at: new Date().toISOString(),
    }));

    return [...existing, ...synthesized].sort((a, b) => a.name.localeCompare(b.name));
  },
});

export type UserRow = Profile & {
  departments: { name: string } | null;
  role: Role | null;
  collegeRole: string;
  department_name?: string | null;
};

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: async (): Promise<UserRow[]> => {
    let remoteProfiles: (Profile & { departments?: { name: string } | null })[] = [];
    const roleMap = new Map<string, Role[]>();

    try {
      // Fetch remote profiles and roles in parallel with a 5s safety timeout
      const [profilesRes, rolesRes] = await Promise.race([
        Promise.all([
          supabase.from("profiles").select("*, departments(name)").order("full_name"),
          supabase.from("user_roles").select("user_id, role"),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Supabase timeout")), 5000),
        ),
      ]);

      if (profilesRes.data) {
        remoteProfiles = profilesRes.data as unknown as (Profile & {
          departments?: { name: string } | null;
        })[];
      }
      if (rolesRes.data) {
        rolesRes.data.forEach((x) =>
          roleMap.set(x.user_id, [...(roleMap.get(x.user_id) ?? []), x.role]),
        );
      }
    } catch (err) {
      console.warn("[usersQuery] Remote fetch fallback:", err);
    }

    const localCache = getUserRoleCache();

    const remoteUsers: UserRow[] = remoteProfiles.map((u) => {
      const rs = roleMap.get(u.id) ?? [];
      const role: Role | null = rs.includes("admin")
        ? "admin"
        : rs.includes("approver")
          ? "approver"
          : rs.includes("staff")
            ? "staff"
            : null;

      const cached = localCache[u.id];
      const resolvedCollegeRole =
        cached?.role ||
        (role === "admin" ? "admin" : role === "approver" ? "principal" : "faculty");

      const resolvedDept = u.departments?.name || cached?.department || "General Administration";

      return {
        ...(u as UserRow),
        role,
        collegeRole: resolvedCollegeRole,
        department_name: resolvedDept,
      };
    });

    const localUsers = getLocalUsers();

    // Deduplicate against remote users by ID and by Email
    const existingIds = new Set(remoteUsers.map((u) => u.id));
    const existingEmails = new Set(
      remoteUsers.map((u) => (u.email ? u.email.trim().toLowerCase() : "")).filter(Boolean),
    );

    const uniqueLocal = localUsers.filter((u) => {
      if (existingIds.has(u.id)) return false;
      const em = (u.email || "").trim().toLowerCase();
      if (em && existingEmails.has(em)) return false;
      return true;
    });

    const merged = [...remoteUsers, ...uniqueLocal];

    // Ensure currently signed in user is visible in the directory if not already included
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authUser) {
        const authEmail = (authUser.email || "").trim().toLowerCase();
        const hasMe =
          existingIds.has(authUser.id) ||
          (authEmail && merged.some((m) => (m.email || "").trim().toLowerCase() === authEmail));

        if (!hasMe) {
          const metaRole = (authUser.user_metadata?.college_role as string) || "admin";
          const meRow: UserRow = {
            id: authUser.id,
            full_name:
              (authUser.user_metadata?.full_name as string) ||
              (authUser.email ? authUser.email.split("@")[0] : "Administrator"),
            email: authUser.email || "",
            phone: (authUser.user_metadata?.phone as string) || null,
            role: "admin",
            collegeRole: metaRole,
            department_id: null,
            department_name:
              (authUser.user_metadata?.department_name as string) || "General Administration",
            departments: {
              name: (authUser.user_metadata?.department_name as string) || "General Administration",
            },
            is_active: true,
            created_at: authUser.created_at || new Date().toISOString(),
          };
          merged.unshift(meRow);
        }
      }
    } catch {
      // Ignored
    }

    return merged;
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
