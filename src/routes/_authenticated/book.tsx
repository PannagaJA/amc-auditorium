import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bookingsRangeQuery, useMe, venuesQuery } from "@/lib/data";
import { conflictsWithBuffer, dayBounds, errMsg, fmtHM, fmtTime, toIso, todayKey, BUFFER_MINUTES } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/book")({
  validateSearch: (s: Record<string, unknown>): { venue?: string } => ({ venue: typeof s["venue"] === "string" ? (s["venue"] as string) : undefined }),
  head: () => ({ meta: [{ title: "New booking — Auditorium Booking" }, { name: "description", content: "Request an auditorium for your event." }, { property: "og:title", content: "New booking — Auditorium Booking" }, { property: "og:description", content: "Request an auditorium for your event." }] }),
  component: Book,
});

function Book() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const venues = useQuery(venuesQuery);
  const active = (venues.data ?? []).filter((v) => v.status === "active");
  const [venueId, setVenueId] = useState(search.venue ?? "");
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState(50);
  const [fac, setFac] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const venue = active.find((v) => v.id === venueId);
  const { from, to } = dayBounds(date);
  const day = useQuery({ ...bookingsRangeQuery(from, to), enabled: !!venueId });
  const dayBookings = (day.data ?? []).filter((b) => b.venue_id === venueId);

  const issues = useMemo(() => {
    const out: string[] = [];
    if (!venue) return out;
    if (end <= start) out.push("End time must be after start time.");
    const o = venue.open_time.slice(0, 5), c = venue.close_time.slice(0, 5);
    if (start < o || end > c) out.push(`Operating hours are ${fmtHM(o)} – ${fmtHM(c)}.`);
    if (attendees > venue.capacity) out.push(`Capacity is ${venue.capacity}.`);
    if (new Date(toIso(date, start)) < new Date()) out.push("Start time must be in the future.");
    if (end > start) {
      const s = toIso(date, start), e = toIso(date, end);
      const clash = dayBookings.find((b) => b.status === "approved" && conflictsWithBuffer(s, e, b.start_at, b.end_at));
      if (clash) out.push(`Clashes with approved "${clash.title}" (${fmtTime(clash.start_at)}–${fmtTime(clash.end_at)}). A ${BUFFER_MINUTES}-minute gap is required.`);
    }
    return out;
  }, [venue, start, end, attendees, date, dayBookings]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!venue) return toast.error("Choose an auditorium");
    if (issues.length) return toast.error(issues[0]);
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      user_id: me.id, venue_id: venue.id, title, purpose, attendees, facilities: fac,
      start_at: toIso(date, start), end_at: toIso(date, end),
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Request submitted for approval");
    qc.invalidateQueries({ queryKey: ["bookings"] });
    navigate({ to: "/bookings" });
  }

  return (
    <div>
      <PageHeader title="New booking" desc="Your request goes to the auditorium's approver." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Auditorium</Label>
                <Select value={venueId} onValueChange={(v) => { setVenueId(v); setFac([]); }}>
                  <SelectTrigger><SelectValue placeholder="Choose an auditorium" /></SelectTrigger>
                  <SelectContent>{active.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {v.capacity} seats</SelectItem>)}</SelectContent>
                </Select>
                {venues.data && active.length === 0 && <p className="text-sm text-muted-foreground">No auditoriums are available yet.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>Start</Label><Input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>End</Label><Input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
              </div>
              <div className="space-y-1.5"><Label>Event title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={150} /></div>
              <div className="space-y-1.5"><Label>Purpose</Label><Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required minLength={5} maxLength={1000} /></div>
              <div className="space-y-1.5"><Label>Expected attendees</Label><Input type="number" min={1} value={attendees} onChange={(e) => setAttendees(Number(e.target.value))} required /></div>
              {venue && venue.facilities.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Facilities needed</Label>
                  <div className="flex flex-wrap gap-4">
                    {venue.facilities.map((f) => (
                      <label key={f} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={fac.includes(f)} onCheckedChange={(c) => setFac(c ? [...fac, f] : fac.filter((x) => x !== f))} />{f}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {issues.length > 0 && <ul className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
              <Button type="submit" disabled={busy || !venue}>{busy ? "Submitting…" : "Submit request"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Already booked that day</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!venue ? <p className="text-muted-foreground">Pick an auditorium to see its schedule.</p> : (
              <>
                <p className="text-muted-foreground">Open {fmtHM(venue.open_time)} – {fmtHM(venue.close_time)} · {BUFFER_MINUTES} min gap between events</p>
                {dayBookings.length === 0 ? <p>No bookings — the whole day is free.</p> : dayBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded border p-2">
                    <span>{fmtTime(b.start_at)}–{fmtTime(b.end_at)}<br /><span className="text-muted-foreground">{b.title}</span></span>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
