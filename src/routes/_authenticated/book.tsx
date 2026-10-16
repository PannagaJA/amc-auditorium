import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createBookingAtomic } from "@/lib/admin.functions";
import { bookingsRangeQuery, useMe, venuesQuery } from "@/lib/data";
import {
  conflictsWithBuffer,
  dayBounds,
  errMsg,
  fmtHM,
  fmtTime,
  toIso,
  todayKey,
  BUFFER_MINUTES,
} from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/book")({
  validateSearch: (s: Record<string, unknown>): { venue?: string } => ({
    venue: typeof s["venue"] === "string" ? (s["venue"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New Booking Request — AMC Auditorium Portal" },
      {
        name: "description",
        content:
          "Submit an auditorium booking request with real-time buffer and availability validation.",
      },
      { property: "og:title", content: "New Booking Request — AMC Auditorium Portal" },
      { property: "og:description", content: "Submit an auditorium booking request." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createBookingAtomic);
  const venues = useQuery(venuesQuery);
  const activeVenues = (venues.data ?? []).filter((v) => v.status === "active");

  const [venueId, setVenueId] = useState(search.venue ?? "");
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState(50);
  const [fac, setFac] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const venue = activeVenues.find((v) => v.id === venueId);
  const { from, to } = dayBounds(date);
  const day = useQuery({ ...bookingsRangeQuery(from, to), enabled: !!venueId });
  const dayBookings = (day.data ?? []).filter((b) => b.venue_id === venueId);

  // Calculate event duration in hours and minutes
  const durationText = useMemo(() => {
    if (!start || !end || end <= start) return null;
    const [sH = 0, sM = 0] = start.split(":").map(Number);
    const [eH = 0, eM = 0] = end.split(":").map(Number);
    const totalMinutes = eH * 60 + eM - (sH * 60 + sM);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} mins`;
    if (hours > 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
    return `${minutes} mins`;
  }, [start, end]);

  // Buffer end time calculation
  const bufferEndTime = useMemo(() => {
    if (!end) return null;
    const [eH = 0, eM = 0] = end.split(":").map(Number);
    const total = eH * 60 + eM + BUFFER_MINUTES;
    const bH = Math.floor(total / 60) % 24;
    const bM = total % 60;
    return `${String(bH).padStart(2, "0")}:${String(bM).padStart(2, "0")}`;
  }, [end]);

  // Real-time Validation Rules
  const issues = useMemo(() => {
    const out: string[] = [];
    if (!venue) return out;

    if (end <= start) {
      out.push("End time must be later than start time.");
    }

    const o = venue.open_time.slice(0, 5);
    const c = venue.close_time.slice(0, 5);
    if (start < o || end > c) {
      out.push(`Auditorium operating hours are ${fmtHM(o)} to ${fmtHM(c)}.`);
    }

    if (attendees > venue.capacity) {
      out.push(
        `Expected attendees (${attendees}) exceed maximum seating capacity (${venue.capacity}).`,
      );
    }

    if (attendees <= 0) {
      out.push("Expected attendees must be at least 1.");
    }

    const startIso = toIso(date, start);
    if (new Date(startIso).getTime() < Date.now()) {
      out.push("Booking start time must be in the future.");
    }

    const maxAdvance = Date.now() + 180 * 24 * 60 * 60 * 1000;
    if (new Date(startIso).getTime() > maxAdvance) {
      out.push("Bookings can only be scheduled up to 180 days in advance.");
    }

    // 30-Minute Buffer Conflict Check against approved bookings
    if (end > start) {
      const s = toIso(date, start);
      const e = toIso(date, end);
      const clash = dayBookings.find(
        (b) => b.status === "approved" && conflictsWithBuffer(s, e, b.start_at, b.end_at),
      );

      if (clash) {
        out.push(
          `Time conflict with confirmed event "${clash.title}" (${fmtTime(clash.start_at)} – ${fmtTime(
            clash.end_at,
          )}). Mandatory ${BUFFER_MINUTES}-minute buffer required between events.`,
        );
      }
    }

    return out;
  }, [venue, start, end, attendees, date, dayBookings]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!venue) return toast.error("Please select an auditorium");
    if (title.trim().length < 3 || title.trim().length > 150) {
      return toast.error("Event title must be between 3 and 150 characters.");
    }
    if (purpose.trim().length < 10 || purpose.trim().length > 1000) {
      return toast.error("Event purpose and agenda must be between 10 and 1,000 characters.");
    }
    if (issues.length) return toast.error(issues[0]);

    setBusy(true);
    try {
      await createFn({
        data: {
          venue_id: venue.id,
          title: title.trim(),
          purpose: purpose.trim(),
          attendees,
          facilities: fac,
          start_at: toIso(date, start),
          end_at: toIso(date, end),
          idempotency_key: idempotencyKey,
        },
      });
      toast.success("Booking request submitted for sanction");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/bookings" });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request Auditorium Booking"
        desc="Submit your event proposal for Principal / HOD and Administration approval."
      />

      {/* Mandatory buffer reminder alert */}
      <div className="rounded-md border border-slate-300 bg-white p-4 shadow-xs flex items-start gap-3">
        <Info className="h-5 w-5 text-[#151b54] shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <strong className="text-foreground block font-semibold text-sm">
            Institutional Scheduling & 30-Minute Buffer Policy
          </strong>
          <p>
            AMC Engineering College mandates an automatic <strong>30-minute buffer interval</strong>{" "}
            between bookings in every auditorium for hall sanitization, sound check, and stage
            turnover. For instance, if an event ends at 11:00 AM, the subsequent booking cannot
            begin before 11:30 AM.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main Booking Form */}
        <Card className="border border-border shadow-xs bg-white">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold text-[#151b54]">
              Event & Scheduling Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-5">
              {/* Auditorium Selection */}
              <div className="space-y-1.5">
                <Label htmlFor="venueSelect" className="text-xs font-semibold text-foreground">
                  Select Auditorium / Seminar Hall *
                </Label>
                <Select
                  value={venueId}
                  onValueChange={(v) => {
                    setVenueId(v);
                    setFac([]);
                  }}
                >
                  <SelectTrigger id="venueSelect" className="h-10 text-sm">
                    <SelectValue placeholder="Choose an auditorium..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeVenues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} — {v.capacity} seats ({v.location || "Campus"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {venue && (
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Operating Hours:{" "}
                      <strong>
                        {fmtHM(venue.open_time)} – {fmtHM(venue.close_time)}
                      </strong>
                    </span>
                    <span>
                      Max Capacity: <strong>{venue.capacity} attendees</strong>
                    </span>
                  </p>
                )}
              </div>

              {/* Date & Time Slot Grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="eventDate" className="text-xs font-semibold text-foreground">
                    Event Date *
                  </Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={date}
                    min={todayKey()}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="startTime" className="text-xs font-semibold text-foreground">
                    Start Time (IST) *
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    step={900}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="endTime" className="text-xs font-semibold text-foreground">
                    End Time (IST) *
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    step={900}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {/* Duration & Buffer Preview */}
              {durationText && bufferEndTime && (
                <div className="rounded-md bg-slate-50 border p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Event Duration:</span>{" "}
                    <strong className="text-foreground">{durationText}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mandatory Buffer Block:</span>{" "}
                    <strong className="text-[#151b54]">
                      {fmtHM(end)} to {fmtHM(bufferEndTime)} (+30 min)
                    </strong>
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="eventTitle" className="text-xs font-semibold text-foreground">
                  Event Title *
                </Label>
                <Input
                  id="eventTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. National Conference on AI in Engineering"
                  required
                  minLength={3}
                  maxLength={150}
                  className="h-10 text-sm"
                />
              </div>

              {/* Purpose */}
              <div className="space-y-1.5">
                <Label htmlFor="eventPurpose" className="text-xs font-semibold text-foreground">
                  Purpose & Event Agenda *
                </Label>
                <Textarea
                  id="eventPurpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Provide brief details on the event, guest speakers, organizing department, and student/faculty participation..."
                  required
                  minLength={5}
                  maxLength={1000}
                  className="min-h-24 text-sm"
                />
              </div>

              {/* Expected Attendees */}
              <div className="space-y-1.5">
                <Label htmlFor="attendees" className="text-xs font-semibold text-foreground">
                  Expected Attendees *
                </Label>
                <div className="relative max-w-xs">
                  <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="attendees"
                    type="number"
                    min={1}
                    max={venue?.capacity || 2000}
                    value={attendees}
                    onChange={(e) => setAttendees(Number(e.target.value))}
                    required
                    className="pl-9 h-10 text-sm"
                  />
                </div>
                {venue && (
                  <p className="text-xs text-muted-foreground">
                    Auditorium capacity limit: {venue.capacity} persons.
                  </p>
                )}
              </div>

              {/* Facilities Checklist */}
              {venue && venue.facilities.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-xs font-semibold text-foreground">
                    Required Facilities & Audio-Visual Setup
                  </Label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {venue.facilities.map((facility) => (
                      <label
                        key={facility}
                        className="flex items-center gap-2.5 rounded border border-border p-2.5 text-xs text-foreground cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <Checkbox
                          checked={fac.includes(facility)}
                          onCheckedChange={(c) =>
                            setFac(c ? [...fac, facility] : fac.filter((x) => x !== facility))
                          }
                        />
                        <span>{facility}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Error / Conflict Warning List */}
              {issues.length > 0 && (
                <div className="rounded-md border border-rose-300 bg-rose-50 p-4 space-y-1 text-xs text-rose-900">
                  <div className="font-semibold flex items-center gap-1.5 text-rose-950">
                    <AlertCircle className="h-4 w-4" />
                    Please correct the following issues before submitting:
                  </div>
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                type="submit"
                disabled={busy || !venue || issues.length > 0}
                className="w-full bg-[#151b54] text-white hover:bg-[#151b54]/90 h-10 text-sm font-medium shadow-xs"
              >
                {busy ? "Validating & Submitting…" : "Submit Booking Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sidebar: Day Availability & Timeline */}
        <div className="space-y-4">
          <Card className="border border-border shadow-xs bg-white">
            <CardHeader className="p-4 pb-2 border-b">
              <CardTitle className="text-sm font-bold text-[#151b54] flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule for {date}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {!venue ? (
                <p className="text-muted-foreground py-4 text-center">
                  Select an auditorium to view its confirmed bookings and buffer periods for this
                  date.
                </p>
              ) : (
                <>
                  <div className="rounded bg-slate-50 border p-2 text-slate-700">
                    <div>
                      <strong>{venue.name}</strong>
                    </div>
                    <div className="text-muted-foreground">
                      Hours: {fmtHM(venue.open_time)} – {fmtHM(venue.close_time)}
                    </div>
                  </div>

                  {dayBookings.length === 0 ? (
                    <div className="rounded border border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-center text-emerald-900">
                      <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600 mb-1" />
                      Entire day is free of bookings.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] block">
                        Existing Slots on this Date:
                      </span>
                      {dayBookings.map((b) => {
                        const bufferEnd = new Date(
                          new Date(b.end_at).getTime() + BUFFER_MINUTES * 60000,
                        );
                        return (
                          <div
                            key={b.id}
                            className="rounded border border-border p-2.5 bg-card space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground truncate max-w-[170px]">
                                {b.title}
                              </span>
                              <StatusBadge status={b.status} />
                            </div>
                            <div className="text-muted-foreground">
                              {fmtTime(b.start_at)} – {fmtTime(b.end_at)}
                            </div>
                            {b.status === "approved" && (
                              <div className="text-[11px] text-amber-800 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200">
                                30-min buffer active until {fmtTime(bufferEnd.toISOString())}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border shadow-xs bg-slate-50 text-xs p-4 space-y-2 text-muted-foreground">
            <strong className="text-foreground block font-semibold text-sm">
              Need Special Assistance?
            </strong>
            <p>
              For multi-day conferences, college-wide symposiums, or high-capacity guest protocols,
              please consult the Central Administration or Principal's Office directly.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
