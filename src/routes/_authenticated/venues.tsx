import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Users as UsersIcon,
  MapPin,
  Clock,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  PowerOff,
  Power,
  Wrench,
  CheckCircle,
  Eye,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteVenue } from "@/lib/admin.functions";
import { validateImageFile } from "@/lib/validations";
import { useMe, usePhotoUrls, usersQuery, venuesQuery, type Venue } from "@/lib/data";
import { errMsg, fmtHM } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/venues")({
  head: () => ({
    meta: [
      { title: "Auditoriums — AMC Engineering College" },
      {
        name: "description",
        content:
          "Browse AMC College auditoriums, capacity, facilities, photos, and live availability.",
      },
      { property: "og:title", content: "Auditoriums — AMC Engineering College" },
      { property: "og:description", content: "Browse auditoriums and facilities." },
    ],
  }),
  component: VenuesPage,
});

function VenuesPage() {
  const me = useMe();
  const q = useQuery(venuesQuery);
  const [edit, setEdit] = useState<Venue | "new" | null>(null);
  const [viewDetails, setViewDetails] = useState<Venue | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const allVenues = q.data ?? [];

  const filteredVenues = useMemo(() => {
    return allVenues.filter((v) => {
      const matchSearch =
        search.trim() === "" ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.location.toLowerCase().includes(search.toLowerCase()) ||
        v.facilities.some((f) => f.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || v.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [allVenues, search, statusFilter]);

  const totalItems = filteredVenues.length;
  const paginatedVenues = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVenues.slice(start, start + pageSize);
  }, [filteredVenues, page, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Auditoriums"
        desc="Official list of auditoriums, seminar halls, capacities, audio-visual equipment, and booking rules."
      >
        {me.isAdmin && (
          <Button
            onClick={() => setEdit("new")}
            className="bg-[#151b54] text-white hover:bg-[#151b54]/90 gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Add Auditorium
          </Button>
        )}
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, location, or facility..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="maintenance">In Maintenance</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Venues Grid */}
      {q.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading auditoriums...</div>
      ) : filteredVenues.length === 0 ? (
        <Empty
          text={
            search || statusFilter !== "all"
              ? "No auditoriums match the selected search criteria."
              : me.isAdmin
                ? "No auditoriums have been added yet. Click 'Add Auditorium' to create the first venue."
                : "No auditoriums are currently available."
          }
          action={
            me.isAdmin && (
              <Button size="sm" onClick={() => setEdit("new")} className="bg-[#151b54] text-white">
                Add First Auditorium
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {paginatedVenues.map((v) => (
            <VenueCard
              key={v.id}
              v={v}
              isAdmin={me.isAdmin}
              onEdit={() => setEdit(v)}
              onViewDetails={() => setViewDetails(v)}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <PaginationControls
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[6, 12, 24]}
      />

      {/* Add / Edit Dialog */}
      {edit && <VenueDialog venue={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}

      {/* Details Modal */}
      {viewDetails && (
        <VenueDetailsModal venue={viewDetails} onClose={() => setViewDetails(null)} />
      )}
    </div>
  );
}

function VenueCard({
  v,
  isAdmin,
  onEdit,
  onViewDetails,
}: {
  v: Venue;
  isAdmin: boolean;
  onEdit: () => void;
  onViewDetails: () => void;
}) {
  const qc = useQueryClient();
  const photos = usePhotoUrls(v.photos.slice(0, 1));
  const [toggleConfirm, setToggleConfirm] = useState<"activate" | "deactivate" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteFn = useServerFn(deleteVenue);

  const statusVariant =
    v.status === "active"
      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
      : v.status === "maintenance"
        ? "bg-amber-50 text-amber-800 border-amber-300"
        : "bg-slate-100 text-slate-700 border-slate-300";

  async function updateStatus(newStatus: Venue["status"]) {
    const { error } = await supabase.from("venues").update({ status: newStatus }).eq("id", v.id);
    if (error) {
      toast.error(errMsg(error));
    } else {
      toast.success(`Auditorium status set to ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["venues"] });
    }
  }

  return (
    <Card className="overflow-hidden border border-border shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        {/* Photo Banner */}
        <div
          className="relative h-44 w-full bg-slate-100 overflow-hidden cursor-pointer"
          onClick={onViewDetails}
        >
          {photos.data?.[0] ? (
            <img
              src={photos.data[0]}
              alt={v.name}
              className="h-full w-full object-cover transition-transform hover:scale-105 duration-300"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-400">
              <ImageIcon className="h-10 w-10 stroke-[1.5]" />
              <span className="text-xs mt-1">No photograph uploaded</span>
            </div>
          )}
          <Badge
            variant="outline"
            className={`absolute top-2.5 right-2.5 text-xs font-semibold capitalize shadow-xs ${statusVariant}`}
          >
            {v.status}
          </Badge>
          {v.photos.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              +{v.photos.length - 1} photos
            </span>
          )}
        </div>

        <CardContent className="space-y-3 p-4">
          <div>
            <h3
              className="font-bold text-base text-foreground hover:text-[#151b54] cursor-pointer truncate"
              onClick={onViewDetails}
            >
              {v.name}
            </h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <UsersIcon className="h-3.5 w-3.5" />
                <strong className="text-foreground">{v.capacity}</strong> seats
              </span>
              {v.location && (
                <span className="flex items-center gap-1 truncate max-w-[150px]">
                  <MapPin className="h-3.5 w-3.5" />
                  {v.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {fmtHM(v.open_time)} – {fmtHM(v.close_time)}
              </span>
            </div>
          </div>

          {v.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
          )}

          {v.status === "maintenance" && v.maintenance_note && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <strong>Maintenance:</strong> {v.maintenance_note}
            </div>
          )}

          {/* Facilities / Equipment chips */}
          <div className="flex flex-wrap gap-1">
            {[...v.facilities, ...v.equipment].slice(0, 3).map((f) => (
              <Badge
                key={f}
                variant="outline"
                className="text-[11px] py-0 px-1.5 bg-slate-50 text-slate-600"
              >
                {f}
              </Badge>
            ))}
            {[...v.facilities, ...v.equipment].length > 3 && (
              <span className="text-[11px] text-muted-foreground">
                +{[...v.facilities, ...v.equipment].length - 3} more
              </span>
            )}
          </div>
        </CardContent>
      </div>

      {/* Card Actions */}
      <div className="border-t border-border p-3 px-4 space-y-2 bg-slate-50/50">
        {/* Row 1: Primary Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 w-full bg-white hover:bg-slate-50"
            onClick={onViewDetails}
          >
            <Eye className="h-3.5 w-3.5" />
            Details
          </Button>

          {v.status === "active" ? (
            <Button
              size="sm"
              asChild
              className="h-8 bg-[#151b54] text-white hover:bg-[#151b54]/90 text-xs w-full shadow-xs"
            >
              <Link to="/book" search={{ venue: v.id }}>
                Book Slot
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="h-8 text-xs text-muted-foreground w-full capitalize"
            >
              {v.status}
            </Button>
          )}
        </div>

        {/* Row 2: Admin Controls */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/70">
            <Button
              size="sm"
              variant="outline"
              className="h-7.5 flex-1 text-xs px-2 bg-white hover:bg-slate-50"
              onClick={onEdit}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7.5 flex-1 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 bg-white"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>

            {v.status === "active" ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7.5 w-8 p-0 text-slate-500 hover:text-destructive hover:bg-rose-50 shrink-0"
                onClick={() => setToggleConfirm("deactivate")}
                title="Deactivate Auditorium"
              >
                <PowerOff className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7.5 w-8 p-0 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 shrink-0"
                onClick={() => setToggleConfirm("activate")}
                title="Activate Auditorium"
              >
                <Power className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Deactivate / Activate Dialog */}
      <AlertDialog open={!!toggleConfirm} onOpenChange={(o) => !o && setToggleConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleConfirm === "deactivate" ? `Deactivate "${v.name}"?` : `Activate "${v.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm === "deactivate"
                ? "This will prevent new bookings from being scheduled for this auditorium. Existing confirmed events will remain on the calendar."
                : "This will make the auditorium immediately available for booking by authorized college staff."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                toggleConfirm === "deactivate"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
              onClick={() => {
                updateStatus(toggleConfirm === "deactivate" ? "inactive" : "active");
                setToggleConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Auditorium Dialog */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auditorium "{v.name}"</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{v.name}</strong> from the campus
              auditorium management system? This action cannot be undone. Auditoriums with pending
              or confirmed bookings cannot be deleted until those bookings are cancelled or
              resolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                setDeleteBusy(true);
                try {
                  await deleteFn({ data: { id: v.id } });
                  toast.success(`Auditorium "${v.name}" deleted successfully`);
                  qc.invalidateQueries({ queryKey: ["venues"] });
                  setDeleteConfirm(false);
                } catch (err) {
                  toast.error(errMsg(err));
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? "Deleting…" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function VenueDetailsModal({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const photoUrls = usePhotoUrls(venue.photos);
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-xl font-bold text-[#151b54]">{venue.name}</DialogTitle>
            <Badge
              variant="outline"
              className={
                venue.status === "active"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : venue.status === "maintenance"
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-slate-100 text-slate-700"
              }
            >
              {venue.status.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Gallery View */}
          {photoUrls.data && photoUrls.data.length > 0 ? (
            <div className="space-y-2">
              <div className="relative h-64 w-full rounded-md bg-slate-100 overflow-hidden border">
                <img
                  src={photoUrls.data[selectedPhoto]}
                  alt={venue.name}
                  className="h-full w-full object-cover"
                />
              </div>
              {photoUrls.data.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photoUrls.data.map((url, idx) => (
                    <button
                      key={url}
                      onClick={() => setSelectedPhoto(idx)}
                      className={`h-16 w-20 shrink-0 rounded border overflow-hidden transition-all ${
                        selectedPhoto === idx
                          ? "ring-2 ring-[#151b54]"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-36 w-full items-center justify-center rounded-md bg-slate-50 border border-dashed text-xs text-muted-foreground">
              No gallery images uploaded for this auditorium.
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-md bg-slate-50 border p-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Seating Capacity</span>
              <strong className="text-foreground text-sm">{venue.capacity} attendees</strong>
            </div>
            <div>
              <span className="text-muted-foreground block">Campus Location</span>
              <strong className="text-foreground text-sm">{venue.location || "Main Campus"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block">Operating Hours</span>
              <strong className="text-foreground text-sm">
                {fmtHM(venue.open_time)} – {fmtHM(venue.close_time)}
              </strong>
            </div>
          </div>

          {/* Description */}
          {venue.description && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Description & Layout
              </span>
              <p className="text-sm text-foreground leading-relaxed rounded border p-3 bg-card">
                {venue.description}
              </p>
            </div>
          )}

          {venue.maintenance_note && venue.status === "maintenance" && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Maintenance Notice:</strong> {venue.maintenance_note}
            </div>
          )}

          {/* Facilities & Equipment */}
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded border p-3 bg-card space-y-1.5">
              <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
                Auditorium Facilities
              </span>
              <div className="flex flex-wrap gap-1">
                {venue.facilities.length > 0 ? (
                  venue.facilities.map((f) => (
                    <Badge key={f} variant="secondary">
                      {f}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">Standard auditorium seating</span>
                )}
              </div>
            </div>

            <div className="rounded border p-3 bg-card space-y-1.5">
              <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] block">
                Available Equipment
              </span>
              <div className="flex flex-wrap gap-1">
                {venue.equipment.length > 0 ? (
                  venue.equipment.map((e) => (
                    <Badge key={e} variant="outline" className="border-slate-300">
                      {e}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">Standard AV setup</span>
                )}
              </div>
            </div>
          </div>

          {/* Scheduling Rules Notice */}
          <div className="rounded bg-slate-50 border p-3 text-xs text-muted-foreground">
            <strong>Booking Policy:</strong> All bookings require approval by College Administration
            / Principal / HOD. A mandatory <strong>30-minute buffer interval</strong> is
            automatically enforced between consecutive bookings to allow for hall preparation.
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {venue.status === "active" && (
            <Button asChild className="bg-[#151b54] text-white hover:bg-[#151b54]/90">
              <Link to="/book" search={{ venue: venue.id }}>
                Book This Auditorium
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function VenueDialog({ venue, onClose }: { venue: Venue | null; onClose: () => void }) {
  const qc = useQueryClient();
  const users = useQuery(usersQuery);
  const approvers = (users.data ?? []).filter(
    (u) => (u.role === "approver" || u.role === "admin") && u.is_active,
  );

  const [f, setF] = useState({
    name: venue?.name ?? "",
    capacity: venue?.capacity ?? 150,
    location: venue?.location ?? "",
    description: venue?.description ?? "",
    open_time: venue?.open_time.slice(0, 5) ?? "08:00",
    close_time: venue?.close_time.slice(0, 5) ?? "20:00",
    facilities: venue?.facilities.join(", ") ?? "Projector, AC, Stage, Sound System",
    equipment: venue?.equipment.join(", ") ?? "Wireless Mics, Podium, Lapel Mic",
    status: venue?.status ?? "active",
    maintenance_note: venue?.maintenance_note ?? "",
    approver_id: venue?.approver_id ?? "none",
  });
  const [photos, setPhotos] = useState<string[]>(venue?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const vResult = validateImageFile(file);
      if (!vResult.valid) {
        toast.error(vResult.error);
        continue;
      }
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage.from("venue-photos").upload(path, file);
      if (error) toast.error(errMsg(error));
      else setPhotos((p) => [...p, path]);
    }
    setBusy(false);
  }

  async function save() {
    if (f.name.trim().length < 3 || f.name.trim().length > 100) {
      return toast.error("Auditorium name must be between 3 and 100 characters.");
    }
    if (f.location.trim().length < 3 || f.location.trim().length > 100) {
      return toast.error("Location must be between 3 and 100 characters.");
    }
    if (f.description.trim().length < 10 || f.description.trim().length > 1000) {
      return toast.error("Description must be between 10 and 1,000 characters.");
    }
    const cap = Number(f.capacity);
    if (isNaN(cap) || cap < 10 || cap > 5000) {
      return toast.error("Capacity must be between 10 and 5,000 seats.");
    }
    if (f.close_time <= f.open_time) {
      return toast.error("Closing time must be after opening time.");
    }

    setBusy(true);
    const row = {
      name: f.name.trim(),
      capacity: Number(f.capacity),
      location: f.location.trim(),
      description: f.description.trim(),
      open_time: f.open_time,
      close_time: f.close_time,
      facilities: list(f.facilities),
      equipment: list(f.equipment),
      status: f.status as Venue["status"],
      maintenance_note: f.maintenance_note.trim() || null,
      approver_id: f.approver_id === "none" ? null : f.approver_id,
      photos,
    };

    const { error } = venue
      ? await supabase.from("venues").update(row).eq("id", venue.id)
      : await supabase.from("venues").insert(row);

    setBusy(false);
    if (error) return toast.error(errMsg(error));

    toast.success(venue ? "Auditorium updated successfully" : "Auditorium added successfully");
    qc.invalidateQueries({ queryKey: ["venues"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{venue ? "Edit Auditorium Details" : "Add New Auditorium"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Auditorium / Seminar Hall Name</Label>
            <Input
              value={f.name}
              onChange={set("name")}
              placeholder="e.g. Dr. A.P.J. Abdul Kalam Memorial Auditorium"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Seating Capacity</Label>
            <Input type="number" min={1} value={f.capacity} onChange={set("capacity")} />
          </div>

          <div className="space-y-1.5">
            <Label>Campus Location / Block</Label>
            <Input
              value={f.location}
              onChange={set("location")}
              placeholder="e.g. Block A, 3rd Floor"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Opening Hours (IST)</Label>
            <Input type="time" value={f.open_time} onChange={set("open_time")} />
          </div>

          <div className="space-y-1.5">
            <Label>Closing Hours (IST)</Label>
            <Input type="time" value={f.close_time} onChange={set("close_time")} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={f.description}
              onChange={set("description")}
              placeholder="Describe venue features, stage dimensions, acoustics, lighting..."
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Facilities (comma-separated)</Label>
            <Input
              value={f.facilities}
              onChange={set("facilities")}
              placeholder="Projector, Central AC, Stage, Sound System, Wi-Fi"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Equipment Available (comma-separated)</Label>
            <Input
              value={f.equipment}
              onChange={set("equipment")}
              placeholder="Wireless Mics, Podium, Lapel Mic, Presentation Clicker"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Operational Status</Label>
            <Select
              value={f.status}
              onValueChange={(v) => setF({ ...f, status: v as Venue["status"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Available for booking)</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive (Deactivated)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Designated Approver</Label>
            <Select value={f.approver_id} onValueChange={(v) => setF({ ...f, approver_id: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Central Administration</SelectItem>
                {approvers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {f.status === "maintenance" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Maintenance Note / Estimated Return Date</Label>
              <Input
                value={f.maintenance_note}
                onChange={set("maintenance_note")}
                placeholder="e.g. Stage lighting replacement in progress until Oct 20"
              />
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Auditorium Photographs (Strict 2 MB Limit per Image)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => upload(e.target.files)}
            />
            <p className="text-[11px] text-muted-foreground">
              Allowed formats: JPG, PNG, WebP. Strict 2 MB maximum size per image.
            </p>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photos.map((p) => (
                  <Badge key={p} variant="secondary" className="gap-1.5 text-xs py-1">
                    {p.slice(37, 57) || "photo"}
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((x) => x !== p))}
                      className="ml-1 text-slate-500 hover:text-destructive"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} className="bg-[#151b54] text-white">
            {busy ? "Saving…" : "Save Auditorium"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
