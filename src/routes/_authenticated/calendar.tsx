import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bookingsRangeQuery, venuesQuery } from "@/lib/data";
import { addDays, dayBounds, dayKey, fmtDate, fmtTime, toIso, todayKey } from "@/lib/format";
import { PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Auditorium Booking" }, { name: "description", content: "Day, week and month availability for every auditorium." }, { property: "og:title", content: "Calendar — Auditorium Booking" }, { property: "og:description", content: "Auditorium availability by day, week and month." }] }),
  component: CalendarPage,
});

type View = "day" | "week" | "month";

function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(todayKey());
  const [venue, setVenue] = useState("all");
  const venues = useQuery(venuesQuery);

  const dow = new Date(toIso(anchor, "12:00")).getUTCDay(); // approx IST weekday
  const weekStart = addDays(anchor, -((dow + 6) % 7));
  const [y, m] = anchor.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const mdow = new Date(toIso(monthStart, "12:00")).getUTCDay();
  const gridStart = addDays(monthStart, -((mdow + 6) % 7));

  const days = view === "day" ? [anchor] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const from = dayBounds(days[0]!).from;
  const to = dayBounds(days[days.length - 1]!).to;
  const q = useQuery(bookingsRangeQuery(from, to));
  const list = (q.data ?? []).filter((b) => venue === "all" || b.venue_id === venue);

  const step = (n: number) => {
    if (view === "day") setAnchor(addDays(anchor, n));
    else if (view === "week") setAnchor(addDays(anchor, 7 * n));
    else { const d = new Date(Date.UTC(y!, m! - 1 + n, 1)); setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`); }
  };
  const label = view === "day" ? fmtDate(toIso(anchor, "12:00")) : view === "week" ? `${fmtDate(toIso(days[0]!, "12:00"))} – ${fmtDate(toIso(days[6]!, "12:00"))}` : new Date(Date.UTC(y!, m! - 1, 15)).toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader title="Calendar" desc="Approved and pending bookings. Pending ones are shown faded.">
        <Select value={venue} onValueChange={setVenue}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All auditoriums</SelectItem>{(venues.data ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}><TabsList><TabsTrigger value="day">Day</TabsTrigger><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="month">Month</TabsTrigger></TabsList></Tabs>
        <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
        <Button variant="outline" onClick={() => setAnchor(todayKey())}>Today</Button>
        <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight /></Button>
        <span className="font-medium">{label}</span>
      </div>
      <div className={cn("grid gap-2", view === "day" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-7")}>
        {view !== "day" && ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="hidden text-center text-xs font-medium text-muted-foreground md:block">{d}</div>)}
        {days.map((d) => {
          const items = list.filter((b) => dayKey(b.start_at) === d);
          const outside = view === "month" && !d.startsWith(monthStart.slice(0, 7));
          return (
            <div key={d} className={cn("rounded-md border bg-card p-2", view === "month" ? "min-h-24" : "min-h-40", outside && "opacity-40", d === todayKey() && "border-primary")}>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{view === "day" ? "" : fmtDate(toIso(d, "12:00")).slice(0, 6)}</div>
              <div className="space-y-1">
                {items.map((b) => (
                  <div key={b.id} title={`${b.title} · ${b.venues?.name}`} className={cn("rounded px-1.5 py-1 text-xs", b.status === "approved" ? "bg-primary/15 text-accent-foreground" : "border border-dashed border-warning/50 bg-warning/10 opacity-80")}>
                    <div className="font-medium">{fmtTime(b.start_at)}–{fmtTime(b.end_at)}</div>
                    <div className="truncate">{b.title}</div>
                    {venue === "all" && <div className="truncate text-muted-foreground">{b.venues?.name}</div>}
                  </div>
                ))}
                {view === "day" && items.length === 0 && <p className="text-sm text-muted-foreground">No bookings.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
