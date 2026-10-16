import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Edit2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { editBooking } from "@/lib/admin.functions";
import {
  errMsg,
  fmtDateTime,
  fmtRange,
  dayKey,
  hm,
  toIso,
  dayBounds,
  conflictsWithBuffer,
  fmtTime,
  fmtHM,
  BUFFER_MINUTES,
  todayKey,
} from "@/lib/format";
import {
  venuesQuery,
  bookingsRangeQuery,
  type BookingRow,
  type BookingStatus,
  type Me,
} from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending Approval",
    className: "bg-amber-50 text-amber-800 border-amber-300 font-medium",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-800 border-emerald-300 font-medium",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-800 border-rose-300 font-medium",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-700 border-slate-300 font-medium",
  },
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const conf = STATUS_CONFIG[status] || { label: status, className: "bg-slate-100 text-slate-700" };
  return (
    <Badge variant="outline" className={cn("text-xs py-0.5 px-2", conf.className, className)}>
      {conf.label}
    </Badge>
  );
}

export function canDecide(me: Me, b: BookingRow) {
  return (
    b.status === "pending" && (me.isAdmin || (me.isApprover && b.venues?.approver_id === me.id))
  );
}

export function BookingCard({
  b,
  me,
  showRequester = true,
  onViewDetails,
}: {
  b: BookingRow;
  me: Me;
  showRequester?: boolean;
  onViewDetails?: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(ok);
    refresh();
  }

  const canEdit =
    b.status === "pending" &&
    (b.user_id === me.id || me.isAdmin) &&
    new Date(b.end_at) > new Date();

  const canCancel =
    (b.status === "pending" || b.status === "approved") &&
    (b.user_id === me.id || me.isAdmin) &&
    new Date(b.end_at) > new Date();

  const handleOpenDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      setDetailsOpen(true);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 transition-all hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3
              className="font-semibold text-foreground text-base hover:text-primary cursor-pointer"
              onClick={handleOpenDetails}
            >
              {b.title}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <strong className="text-foreground">{b.venues?.name || "Auditorium"}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {fmtRange(b.start_at, b.end_at)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {b.attendees} attendees
            </span>
          </div>
          {showRequester && (
            <div className="text-xs text-muted-foreground">
              Requested by{" "}
              <span className="font-medium text-foreground">
                {b.requester?.full_name || b.requester?.email}
              </span>
              {b.requester?.phone ? ` (${b.requester.phone})` : ""}
            </div>
          )}
        </div>
        <StatusBadge status={b.status} />
      </div>

      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{b.purpose}</p>

      {b.facilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {b.facilities.map((f) => (
            <Badge key={f} variant="secondary" className="text-xs bg-slate-100 text-slate-700">
              {f}
            </Badge>
          ))}
        </div>
      )}

      {b.rejection_reason && (
        <div className="mt-2 rounded bg-rose-50 border border-rose-200 p-2 text-xs text-rose-800">
          <strong>Rejection reason:</strong> {b.rejection_reason}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          onClick={handleOpenDetails}
        >
          <Eye className="h-3.5 w-3.5" />
          View Details
        </Button>

        <div className="flex flex-wrap gap-2">
          {canDecide(me, b) && (
            <>
              <Button
                size="sm"
                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                disabled={busy}
                onClick={() => setApproveOpen(true)}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800 text-xs"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}

          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={busy}
              onClick={() => setEditOpen(true)}
            >
              <Edit2 className="h-3 w-3" />
              Edit
            </Button>
          )}

          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-destructive text-xs"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
            >
              Cancel Booking
            </Button>
          )}
        </div>
      </div>

      {/* Details Dialog */}
      <BookingDetailsModal booking={b} open={detailsOpen} onClose={() => setDetailsOpen(false)} />

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Booking Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <strong>"{b.title}"</strong> for {b.venues?.name}?
              This will reserve the auditorium and apply the mandatory 30-minute buffer after the
              event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={async () => {
                await run(
                  () => supabase.rpc("approve_booking", { _booking: b.id }),
                  "Booking approved successfully",
                );
                setApproveOpen(false);
              }}
            >
              Confirm Approval
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking: "{b.title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Please provide the official reason for rejecting this booking request. This
              explanation will be notified to the requester.
            </p>
            <Textarea
              placeholder="e.g., Scheduled maintenance or conflicting college academic schedule (minimum 5 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="min-h-24 text-sm"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Minimum 5 characters required</span>
              <span>{reason.trim().length}/500</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || reason.trim().length < 5 || reason.trim().length > 500}
              onClick={async () => {
                await run(
                  () => supabase.rpc("reject_booking", { _booking: b.id, _reason: reason.trim() }),
                  "Booking rejected with explanation",
                );
                setRejectOpen(false);
              }}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the booking <strong>"{b.title}"</strong>? This will
              release the reserved auditorium slot and buffer period immediately for other college
              events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await run(
                  () => supabase.rpc("cancel_booking", { _booking: b.id }),
                  "Booking cancelled",
                );
                setCancelOpen(false);
              }}
            >
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Booking Modal */}
      {editOpen && (
        <EditBookingModal booking={b} open={editOpen} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

export function BookingDetailsModal({
  booking,
  open,
  onClose,
}: {
  booking: BookingRow | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-xl font-bold text-brand-navy">{booking.title}</DialogTitle>
            <StatusBadge status={booking.status} />
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-md bg-slate-50 border p-3 grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted-foreground block">Auditorium</span>
              <strong className="text-foreground">{booking.venues?.name || "Venue"}</strong>
              {booking.venues?.location && (
                <span className="text-xs text-muted-foreground block">
                  {booking.venues.location}
                </span>
              )}
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Expected Attendees</span>
              <strong className="text-foreground">{booking.attendees} attendees</strong>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground block">Event Schedule</span>
              <strong className="text-foreground">
                {fmtRange(booking.start_at, booking.end_at)}
              </strong>
              <span className="text-xs text-muted-foreground block mt-0.5">
                Note: 30-minute buffer follows this event slot.
              </span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Event Purpose & Details
            </span>
            <p className="rounded border bg-card p-3 text-foreground whitespace-pre-wrap">
              {booking.purpose}
            </p>
          </div>

          {booking.facilities.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Requested Facilities & Equipment
              </span>
              <div className="flex flex-wrap gap-1.5">
                {booking.facilities.map((fac) => (
                  <Badge key={fac} variant="secondary">
                    {fac}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              <span>Requested by:</span>
              <p className="font-medium text-foreground">
                {booking.requester?.full_name || booking.requester?.email}
              </p>
              {booking.requester?.email && <p>{booking.requester.email}</p>}
              {booking.requester?.phone && <p>{booking.requester.phone}</p>}
            </div>
            <div>
              <span>Submitted at:</span>
              <p className="font-medium text-foreground">{fmtDateTime(booking.created_at)}</p>
            </div>
          </div>

          {booking.rejection_reason && (
            <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <strong>Rejection explanation:</strong> {booking.rejection_reason}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditBookingModal({
  booking,
  open,
  onClose,
}: {
  booking: BookingRow;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editFn = useServerFn(editBooking);
  const venues = useQuery(venuesQuery);
  const activeVenues = (venues.data ?? []).filter(
    (v) => v.status === "active" || v.id === booking.venue_id,
  );

  const [venueId, setVenueId] = useState(booking.venue_id);
  const [date, setDate] = useState(dayKey(booking.start_at));
  const [start, setStart] = useState(hm(booking.start_at));
  const [end, setEnd] = useState(hm(booking.end_at));
  const [title, setTitle] = useState(booking.title);
  const [purpose, setPurpose] = useState(booking.purpose);
  const [attendees, setAttendees] = useState(booking.attendees);
  const [facilities, setFacilities] = useState<string[]>(booking.facilities ?? []);
  const [busy, setBusy] = useState(false);

  const selectedVenue = activeVenues.find((v) => v.id === venueId);

  // Buffer and slot validation against approved bookings (excluding this booking)
  const { from, to } = dayBounds(date);
  const dayBookingsQ = useQuery({
    ...bookingsRangeQuery(from, to),
    enabled: !!venueId,
  });
  const approvedDayBookings = (dayBookingsQ.data ?? []).filter(
    (b) => b.venue_id === venueId && b.status === "approved" && b.id !== booking.id,
  );

  const issues = useMemo(() => {
    const list: string[] = [];
    if (!selectedVenue) {
      list.push("Please select an auditorium.");
      return list;
    }
    if (title.trim().length < 3 || title.trim().length > 150) {
      list.push("Title must be between 3 and 150 characters.");
    }
    if (purpose.trim().length < 10 || purpose.trim().length > 1000) {
      list.push("Purpose must be between 10 and 1,000 characters.");
    }
    if (attendees < 1) {
      list.push("Expected attendees must be at least 1.");
    } else if (attendees > selectedVenue.capacity) {
      list.push(`Attendees (${attendees}) exceed auditorium capacity (${selectedVenue.capacity}).`);
    }
    if (!start || !end) {
      list.push("Start and end times are required.");
    } else if (end <= start) {
      list.push("End time must be after start time.");
    }

    if (start && end && end > start) {
      const sIso = toIso(date, start);
      const eIso = toIso(date, end);
      if (new Date(sIso).getTime() < Date.now()) {
        list.push("Booking start time must be in the future.");
      }
      const clash = approvedDayBookings.find((b) =>
        conflictsWithBuffer(sIso, eIso, b.start_at, b.end_at),
      );
      if (clash) {
        list.push(
          `Conflict with confirmed event "${clash.title}" (${fmtTime(clash.start_at)} – ${fmtTime(
            clash.end_at,
          )}). 30-minute buffer enforced.`,
        );
      }
    }
    return list;
  }, [selectedVenue, title, purpose, attendees, start, end, date, approvedDayBookings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (issues.length) return toast.error(issues[0]);
    setBusy(true);
    try {
      await editFn({
        data: {
          id: booking.id,
          venue_id: venueId,
          title: title.trim(),
          purpose: purpose.trim(),
          attendees,
          facilities,
          start_at: toIso(date, start),
          end_at: toIso(date, end),
        },
      });
      toast.success("Booking request updated successfully");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#151b54]">
            Edit Booking Proposal
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Auditorium *</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Choose auditorium..." />
              </SelectTrigger>
              <SelectContent>
                {activeVenues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} ({v.capacity} seats)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Event Date *</Label>
              <Input
                type="date"
                min={todayKey()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Time *</Label>
              <Input
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">End Time *</Label>
              <Input
                type="time"
                step={900}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Event Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Technical Symposium"
              required
              minLength={3}
              maxLength={150}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Purpose & Agenda *</Label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe event details..."
              required
              minLength={10}
              maxLength={1000}
              className="min-h-20 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Expected Attendees *</Label>
            <Input
              type="number"
              min={1}
              max={selectedVenue?.capacity || 3000}
              value={attendees}
              onChange={(e) => setAttendees(Number(e.target.value))}
              required
              className="h-9 text-sm max-w-xs"
            />
          </div>

          {selectedVenue && selectedVenue.facilities.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-semibold">Required Facilities</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedVenue.facilities.map((f) => (
                  <label
                    key={f}
                    className="flex items-center gap-2 rounded border p-2 text-xs cursor-pointer hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={facilities.includes(f)}
                      onCheckedChange={(c) =>
                        setFacilities(c ? [...facilities, f] : facilities.filter((x) => x !== f))
                      }
                    />
                    <span>{f}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <div className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
              <span className="font-semibold block">Please fix the following:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || issues.length > 0}
              className="bg-[#151b54] text-white"
            >
              {busy ? "Saving Changes…" : "Update Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PageHeader({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground space-y-3">
      <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <p>{text}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
