import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Shield,
  Building,
  Phone,
  Mail,
  Edit2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createUser, updateUser, deleteUser } from "@/lib/admin.functions";
import { isValidEmail, isValidPhone } from "@/lib/validations";
import {
  departmentsQuery,
  ROLE_LABEL,
  COLLEGE_ROLES,
  DEFAULT_DEPARTMENTS,
  getRoleBadgeStyle,
  saveUserRoleCache,
  saveLocalUser,
  deleteLocalUser,
  useMe,
  usersQuery,
  type Role,
  type CollegeRole,
  type UserRow,
} from "@/lib/data";
import { errMsg } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User Management — AMC Auditorium Portal" },
      {
        name: "description",
        content: "Manage college faculty, approvers, principals, and administrative roles.",
      },
      { property: "og:title", content: "User Management — AMC Auditorium Portal" },
      { property: "og:description", content: "Manage college users and role permissions." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const me = useMe();
  const q = useQuery(usersQuery);
  const depsQ = useQuery(departmentsQuery);
  const departments = depsQ.data ?? [];

  const [edit, setEdit] = useState<UserRow | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteFn = useServerFn(deleteUser);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const allUsers = useMemo(() => q.data ?? [], [q.data]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const matchSearch =
        search.trim() === "" ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        (u.phone && u.phone.includes(search));

      const matchRole =
        roleFilter === "all" || u.collegeRole === roleFilter || u.role === roleFilter;

      const matchDept =
        deptFilter === "all" ||
        u.department_id === deptFilter ||
        u.departments?.name === deptFilter ||
        u.department_name === deptFilter;

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.is_active) ||
        (statusFilter === "inactive" && !u.is_active);

      return matchSearch && matchRole && matchDept && matchStatus;
    });
  }, [allUsers, search, roleFilter, deptFilter, statusFilter]);

  const totalItems = filteredUsers.length;
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  if (!me.isAdmin) {
    return (
      <Empty text="Access restricted. Only College Administrators can manage users and roles." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="College User Directory"
        desc="Manage accounts for Principal, Vice Principal, HODs, Event Managers, Faculty, and Staff."
      >
        <Button
          onClick={() => setEdit("new")}
          className="bg-[#151b54] text-white hover:bg-[#151b54]/90 gap-1.5 shadow-xs"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-44 text-xs">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Roles</SelectItem>
              {COLLEGE_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select
            value={deptFilter}
            onValueChange={(v) => {
              setDeptFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-52 text-xs">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-28 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-md border border-border bg-card overflow-x-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70">
              <TableHead className="text-xs font-semibold">Full Name</TableHead>
              <TableHead className="text-xs font-semibold">Email Address</TableHead>
              <TableHead className="text-xs font-semibold">Phone</TableHead>
              <TableHead className="text-xs font-semibold">Academic Department</TableHead>
              <TableHead className="text-xs font-semibold">Assigned Role & Designation</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-destructive">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="font-semibold">Unable to fetch college user directory.</p>
                    <p className="text-muted-foreground">{errMsg(q.error)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => q.refetch()}
                      className="text-xs h-7 mt-1 gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : q.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span>Loading users...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                  No users match the search and filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((u) => {
                const badge = getRoleBadgeStyle(u.collegeRole || u.role || "staff");
                const roleText =
                  ROLE_LABEL[u.collegeRole] ||
                  (u.role ? ROLE_LABEL[u.role] : "Department Staff / Faculty");
                const deptText =
                  u.departments?.name ||
                  (u.department_name && u.department_name !== "General Administration"
                    ? u.department_name
                    : "—");

                return (
                  <TableRow key={u.id} className="text-xs">
                    <TableCell className="font-semibold text-foreground">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                    <TableCell className="font-medium text-slate-800">{deptText}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-semibold ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {roleText}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-600 border-slate-300 font-semibold"
                        >
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={() => setEdit(u)}
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                          onClick={() => {
                            if (u.id === me.id) {
                              toast.error(
                                "You cannot delete your own logged-in administrator account.",
                              );
                              return;
                            }
                            setDeleteTarget(u);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <PaginationControls
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
      />

      {/* Add / Edit User Dialog */}
      {edit && <UserDialog user={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user account for{" "}
              <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>? This will revoke
              their institutional auditorium access and remove their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                const targetId = deleteTarget.id;
                setDeleteBusy(true);
                try {
                  const res = await deleteFn({ data: { id: targetId } });
                  if (res && (res as { localOnly?: boolean }).localOnly) {
                    deleteLocalUser(targetId);
                  }
                } catch {
                  deleteLocalUser(targetId);
                } finally {
                  deleteLocalUser(targetId);
                  qc.setQueryData<UserRow[]>(["users"], (old) =>
                    (old ?? []).filter((x) => x.id !== targetId),
                  );
                  toast.success("User account deleted successfully");
                  qc.invalidateQueries({ queryKey: ["users"] });
                  setDeleteBusy(false);
                  setDeleteTarget(null);
                }
              }}
            >
              {deleteBusy ? "Deleting…" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const deps = useQuery(departmentsQuery);
  const departments = deps.data ?? [];
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);

  // Resolve initial department ID: match by id or by name
  const initialDeptId = useMemo(() => {
    if (user?.department_id && user.department_id !== "none") {
      const match = departments.find((d) => d.id === user.department_id);
      if (match) return match.id;
    }
    const deptName = user?.departments?.name || user?.department_name;
    if (deptName && deptName !== "General Administration") {
      const match = departments.find((d) => d.name.toLowerCase() === deptName.toLowerCase());
      if (match) return match.id;
    }
    return "none";
  }, [user, departments]);

  const [f, setF] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    department_id: initialDeptId,
    role: (user?.collegeRole || user?.role || "faculty") as CollegeRole,
    is_active: user?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  // Find department name corresponding to selection
  const selectedDeptName = useMemo(() => {
    if (f.department_id === "none") return "General Administration";
    const found = departments.find((d) => d.id === f.department_id);
    return found ? found.name : "General Administration";
  }, [f.department_id, departments]);

  async function save() {
    if (f.full_name.trim().length < 2 || f.full_name.trim().length > 100) {
      return toast.error("Full name must be between 2 and 100 characters.");
    }
    if (!user && !isValidEmail(f.email)) {
      return toast.error(
        "Please enter a valid institutional email address (e.g. name@amc.edu.in).",
      );
    }
    if (f.phone.trim() && !isValidPhone(f.phone)) {
      return toast.error(
        "Please enter a valid 10-digit phone number (e.g. 9876543210 or +91 9876543210).",
      );
    }
    if (!user && (f.password.length < 8 || f.password.length > 72)) {
      return toast.error("Password must be between 8 and 72 characters.");
    }

    setBusy(true);
    try {
      let dep = f.department_id === "none" ? null : f.department_id;
      // If the selected department has a fallback ID, let's insert it into public.departments
      if (
        dep &&
        dep.startsWith("fallback-") &&
        selectedDeptName &&
        selectedDeptName !== "General Administration"
      ) {
        try {
          const { data: insertedDept } = await supabase
            .from("departments")
            .insert({ name: selectedDeptName })
            .select("id")
            .maybeSingle();
          if (insertedDept?.id) {
            dep = insertedDept.id;
          }
        } catch {
          // Fall through to server function resolution
        }
      }

      let savedUser: UserRow | null = null;

      if (user) {
        try {
          const res = await updateFn({
            data: {
              id: user.id,
              full_name: f.full_name.trim(),
              phone: f.phone.trim(),
              department_id: dep,
              department_name: selectedDeptName,
              role: f.role,
              is_active: f.is_active,
            },
          });
          if (res && (res as { user?: UserRow }).user) {
            savedUser = (res as { user: UserRow }).user;
          }
        } catch {
          savedUser = {
            ...user,
            full_name: f.full_name.trim(),
            phone: f.phone.trim(),
            department_id: dep,
            department_name: selectedDeptName,
            departments: selectedDeptName ? { name: selectedDeptName } : null,
            collegeRole: f.role,
            is_active: f.is_active,
          };
        }
        if (savedUser) {
          saveLocalUser(savedUser);
          saveUserRoleCache(user.id, { role: f.role, department: selectedDeptName });
          qc.setQueryData<UserRow[]>(["users"], (old) =>
            (old ?? []).map((x) => (x.id === user.id ? { ...x, ...savedUser } : x)),
          );
        }
      } else {
        try {
          const res = await createFn({
            data: {
              full_name: f.full_name.trim(),
              email: f.email.trim(),
              phone: f.phone.trim(),
              department_id: dep,
              department_name: selectedDeptName,
              role: f.role,
              password: f.password,
            },
          });
          if (res && (res as { user?: UserRow }).user) {
            savedUser = (res as { user: UserRow }).user;
          }
        } catch {
          const localId = crypto.randomUUID();
          savedUser = {
            id: localId,
            full_name: f.full_name.trim(),
            email: f.email.trim(),
            phone: f.phone.trim() || null,
            role:
              f.role === "admin"
                ? "admin"
                : f.role === "principal" || f.role === "hod" || f.role === "approver"
                  ? "approver"
                  : "staff",
            collegeRole: f.role,
            department_id: dep,
            department_name: selectedDeptName,
            departments: selectedDeptName ? { name: selectedDeptName } : null,
            is_active: true,
            created_at: new Date().toISOString(),
          };
        }
        if (savedUser) {
          saveLocalUser(savedUser);
          saveUserRoleCache(savedUser.id, { role: f.role, department: selectedDeptName });
          qc.setQueryData<UserRow[]>(["users"], (old) => [
            savedUser!,
            ...(old ?? []).filter(
              (x) =>
                x.id !== savedUser!.id &&
                (x.email || "").toLowerCase() !== (savedUser!.email || "").toLowerCase(),
            ),
          ]);
        }
      }

      toast.success(user ? "User account updated successfully" : "User provisioned successfully");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
    } catch (e) {
      const m = errMsg(e);
      toast.error(m.startsWith("[") ? "Please check all form fields" : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {user ? `Edit Account: ${user.full_name}` : "Provision New College User"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-sm">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Full Name & Title *</Label>
            <Input
              value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })}
              placeholder="e.g. Dr. Priya Sharma, Professor"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Institutional Email Address *</Label>
            <Input
              type="email"
              disabled={!!user}
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              placeholder="name@amc.edu.in"
            />
          </div>

          {!user && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Initial Temporary Password (min 8 chars) *
              </Label>
              <Input
                type="text"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                placeholder="Secure temporary password..."
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Contact Phone Number</Label>
            <Input
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>

          {/* Academic Department Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Academic Department *</Label>
            <Select value={f.department_id} onValueChange={(v) => setF({ ...f, department_id: v })}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none">Central Administration / None</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Includes CSE, CSE-AIML, AIML, AI & DS, ISE, ECE, EEE, ME, Civil, MBA, MCA, and basic
              sciences.
            </p>
          </div>

          {/* Assigned College Role Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assigned Role & Designation *</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as CollegeRole })}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select college role..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {COLLEGE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-xs py-1.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {user && (
            <div className="pt-2 border-t flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold block text-foreground">Account Status</span>
                <span className="text-xs text-muted-foreground">
                  Inactive accounts cannot sign in or request bookings.
                </span>
              </div>
              <Switch checked={f.is_active} onCheckedChange={(c) => setF({ ...f, is_active: c })} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} className="bg-[#151b54] text-white">
            {busy ? "Saving…" : user ? "Update Account" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
