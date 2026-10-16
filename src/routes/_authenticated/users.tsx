import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/lib/admin.functions";
import { departmentsQuery, ROLE_LABEL, useMe, usersQuery, type Role, type UserRow } from "@/lib/data";
import { errMsg } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Auditorium Booking" }, { name: "description", content: "Manage staff, approvers and administrators." }, { property: "og:title", content: "Users — Auditorium Booking" }, { property: "og:description", content: "Manage staff, approvers and administrators." }] }),
  component: UsersPage,
});

function UsersPage() {
  const me = useMe();
  const q = useQuery(usersQuery);
  const [edit, setEdit] = useState<UserRow | "new" | null>(null);
  const [search, setSearch] = useState("");
  if (!me.isAdmin) return <Empty text="Only administrators can manage users." />;
  const rows = (q.data ?? []).filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <PageHeader title="Users" desc="Add people and set what they can do."><Button onClick={() => setEdit("new")}>Add user</Button></PageHeader>
      <Input placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Department</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.departments?.name ?? "—"}</TableCell>
                <TableCell>{u.role ? ROLE_LABEL[u.role] : "—"}</TableCell>
                <TableCell>{u.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setEdit(u)}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {edit && <UserDialog user={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function UserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const deps = useQuery(departmentsQuery);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const [f, setF] = useState({
    full_name: user?.full_name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", password: "",
    department_id: user?.department_id ?? "none", role: (user?.role ?? "staff") as Role, is_active: user?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const dep = f.department_id === "none" ? null : f.department_id;
      if (user) await updateFn({ data: { id: user.id, full_name: f.full_name, phone: f.phone, department_id: dep, role: f.role, is_active: f.is_active } });
      else await createFn({ data: { full_name: f.full_name, email: f.email, phone: f.phone, department_id: dep, role: f.role, password: f.password } });
      toast.success(user ? "User updated" : "User created — share the password with them");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
    } catch (e) {
      const m = errMsg(e);
      toast.error(m.startsWith("[") ? "Please check the form fields" : m);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" disabled={!!user} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          {!user && <div className="space-y-1.5"><Label>Temporary password (min 8)</Label><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>}
          <div className="space-y-1.5"><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Department</Label>
              <Select value={f.department_id} onValueChange={(v) => setF({ ...f, department_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{(deps.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Role</Label>
              <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["staff", "approver", "admin"] as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {user && <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(c) => setF({ ...f, is_active: c })} />Account active</label>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
