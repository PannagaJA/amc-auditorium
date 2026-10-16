import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users as UsersIcon, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePhotoUrls, usersQuery, venuesQuery, type Venue } from "@/lib/data";
import { errMsg, fmtHM } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/venues")({
  head: () => ({ meta: [{ title: "Auditoriums — Auditorium Booking" }, { name: "description", content: "Browse auditoriums, capacity, facilities and hours." }, { property: "og:title", content: "Auditoriums — Auditorium Booking" }, { property: "og:description", content: "Browse auditoriums, capacity and facilities." }] }),
  component: Venues,
});

function Venues() {
  const me = useMe();
  const q = useQuery(venuesQuery);
  const [edit, setEdit] = useState<Venue | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Auditoriums" desc="Capacity, facilities and operating hours.">
        {me.isAdmin && <Button onClick={() => setEdit("new")}>Add auditorium</Button>}
      </PageHeader>
      {q.data?.length === 0 ? <Empty text={me.isAdmin ? "No auditoriums yet. Add the first one." : "No auditoriums have been added yet."} /> : (
        <div className="grid gap-4 md:grid-cols-2">{(q.data ?? []).map((v) => <VenueCard key={v.id} v={v} isAdmin={me.isAdmin} onEdit={() => setEdit(v)} />)}</div>
      )}
      {edit && <VenueDialog venue={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function VenueCard({ v, isAdmin, onEdit }: { v: Venue; isAdmin: boolean; onEdit: () => void }) {
  const photos = usePhotoUrls(v.photos.slice(0, 1));
  return (
    <Card className="overflow-hidden">
      {photos.data?.[0] ? <img src={photos.data[0]} alt={v.name} className="h-44 w-full object-cover" /> : <div className="h-2 bg-primary/30" />}
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{v.name}</h3>
          <Badge variant={v.status === "active" ? "secondary" : "outline"} className="capitalize">{v.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><UsersIcon className="h-4 w-4" />{v.capacity}</span>
          {v.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{v.location}</span>}
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{fmtHM(v.open_time)} – {fmtHM(v.close_time)}</span>
        </div>
        {v.description && <p className="text-sm">{v.description}</p>}
        {v.status === "maintenance" && v.maintenance_note && <p className="text-sm text-warning">{v.maintenance_note}</p>}
        <div className="flex flex-wrap gap-1">{[...v.facilities, ...v.equipment].map((f) => <Badge key={f} variant="outline">{f}</Badge>)}</div>
        <div className="flex gap-2 pt-2">
          {v.status === "active" && <Button size="sm" asChild><Link to="/book" search={{ venue: v.id }}>Book</Link></Button>}
          {isAdmin && <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function VenueDialog({ venue, onClose }: { venue: Venue | null; onClose: () => void }) {
  const qc = useQueryClient();
  const users = useQuery(usersQuery);
  const approvers = (users.data ?? []).filter((u) => u.role === "approver" && u.is_active);
  const [f, setF] = useState({
    name: venue?.name ?? "", capacity: venue?.capacity ?? 100, location: venue?.location ?? "", description: venue?.description ?? "",
    open_time: venue?.open_time.slice(0, 5) ?? "08:00", close_time: venue?.close_time.slice(0, 5) ?? "20:00",
    facilities: venue?.facilities.join(", ") ?? "", equipment: venue?.equipment.join(", ") ?? "",
    status: venue?.status ?? "active", maintenance_note: venue?.maintenance_note ?? "", approver_id: venue?.approver_id ?? "none",
  });
  const [photos, setPhotos] = useState<string[]>(venue?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is over 5 MB`); continue; }
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("venue-photos").upload(path, file);
      if (error) toast.error(errMsg(error)); else setPhotos((p) => [...p, path]);
    }
    setBusy(false);
  }

  async function save() {
    if (f.name.trim().length < 2) return toast.error("Name is required");
    if (f.close_time <= f.open_time) return toast.error("Closing time must be after opening time");
    setBusy(true);
    const row = {
      name: f.name.trim(), capacity: Number(f.capacity), location: f.location, description: f.description,
      open_time: f.open_time, close_time: f.close_time, facilities: list(f.facilities), equipment: list(f.equipment),
      status: f.status as Venue["status"], maintenance_note: f.maintenance_note || null,
      approver_id: f.approver_id === "none" ? null : f.approver_id, photos,
    };
    const { error } = venue ? await supabase.from("venues").update(row).eq("id", venue.id) : await supabase.from("venues").insert(row);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Auditorium saved");
    qc.invalidateQueries({ queryKey: ["venues"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{venue ? "Edit auditorium" : "Add auditorium"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Name</Label><Input value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} value={f.capacity} onChange={set("capacity")} /></div>
          <div className="space-y-1.5"><Label>Location</Label><Input value={f.location} onChange={set("location")} /></div>
          <div className="space-y-1.5"><Label>Opens</Label><Input type="time" value={f.open_time} onChange={set("open_time")} /></div>
          <div className="space-y-1.5"><Label>Closes</Label><Input type="time" value={f.close_time} onChange={set("close_time")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea value={f.description} onChange={set("description")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Facilities (comma separated)</Label><Input value={f.facilities} onChange={set("facilities")} placeholder="Projector, Sound system, AC" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Equipment (comma separated)</Label><Input value={f.equipment} onChange={set("equipment")} placeholder="Wireless mics, Podium" /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Venue["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Approver (Principal / HOD)</Label>
            <Select value={f.approver_id} onValueChange={(v) => setF({ ...f, approver_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Admins only</SelectItem>{approvers.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {f.status === "maintenance" && <div className="space-y-1.5 sm:col-span-2"><Label>Maintenance note</Label><Input value={f.maintenance_note} onChange={set("maintenance_note")} /></div>}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Photos</Label>
            <Input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} />
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">{photos.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1">{p.slice(37, 57) || "photo"}<button onClick={() => setPhotos(photos.filter((x) => x !== p))} aria-label="Remove">×</button></Badge>
              ))}</div>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
