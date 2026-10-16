import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  MapPin,
} from "lucide-react";
import { bookingsRangeQuery, venuesQuery, type BookingRow } from "@/lib/data";
import {
  addDays,
  dayBounds,
  dayKey,
  fmtDate,
  fmtTime,
  toIso,
  todayKey,
  BUFFER_MINUTES,
} from "@/lib/format";
import { BookingDetailsModal, PageHeader, StatusBadge } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Schedule Calendar — AMC Auditorium Portal" },
      {
        name: "description",
        content:
          "Campus-wide auditorium schedule with day, week, and month views and 30-minute buffer visualization.",
      },
      { property: "og:title", content: "Schedule Calendar — AMC Auditorium Portal" },
      { property: "og:description", content: "Auditorium availability by day, week, and month." },
    ],
  }),
  component: CalendarPage,
});

type View = "day" | "week" | "month";

function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(todayKey());
  const [venue, setVenue] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);

  const venues = useQuery(venuesQuery);

  const dow = new Date(toIso(anchor, "12:00")).getUTCDay(); // approx IST weekday
  const weekStart = addDays(anchor, -((dow + 6) % 7));
  const [y, m] = anchor.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const mdow = new Date(toIso(monthStart, "12:00")).getUTCDay();
  const gridStart = addDays(monthStart, -((mdow + 6) % 7));

  const days =
    view === "day"
      ? [anchor]
      : view === "week"
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const from = dayBounds(days[0]!).from;
  const to = dayBounds(days[days.length - 1]!).to;
  const q = useQuery(bookingsRangeQuery(from, to));
  const list = (q.data ?? []).filter((b) => venue === "all" || b.venue_id === venue);

  const step = (n: number) => {
    if (view === "day") setAnchor(addDays(anchor, n));
    else if (view === "week") setAnchor(addDays(anchor, 7 * n));
    else {
      const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
      setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  };

  const label =
    view === "day"
      ? fmtDate(toIso(anchor, "12:00"))
      : view === "week"
        ? `${fmtDate(toIso(days[0]!, "12:00"))} – ${fmtDate(toIso(days[6]!, "12:00"))}`
        : new Date(Date.UTC(y!, m! - 1, 15)).toLocaleString("en-IN", {
            month: "long",
            year: "numeric",
          });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditorium Schedule Calendar"
        desc="Real-time visibility into approved events, pending requests, and mandatory 30-minute buffers."
      >
        <Select value={venue} onValueChange={setVenue}>
          <SelectTrigger className="w-full sm:w-64 h-9 text-xs">
            <SelectValue placeholder="All Auditoriums" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campus Auditoriums</SelectItem>
            {(venues.data ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Legend & Controls Bar */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList className="bg-slate-100 p-0.5">
              <TabsTrigger value="day" className="text-xs">
                Day View
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs">
                Week View
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs">
                Month View
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => step(-1)}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => setAnchor(todayKey())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => step(1)}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <span className="font-bold text-sm text-[#151b54] ml-1">{label}</span>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#151b54]" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 border border-amber-600 border-dashed" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-xs border border-slate-300 slot-buffer" />
            <span>30m Buffer</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        className={cn("grid gap-2", view === "day" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-7")}
      >
        {view !== "day" &&
          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
            (d) => (
              <div
                key={d}
                className="hidden text-center text-xs font-bold uppercase tracking-wider text-muted-foreground p-2 bg-slate-50 border rounded md:block"
              >
                {d}
              </div>
            ),
          )}

        {days.map((d) => {
          const items = list.filter((b) => dayKey(b.start_at) === d);
          const outside = view === "month" && !d.startsWith(monthStart.slice(0, 7));
          const isToday = d === todayKey();

          return (
            <div
              key={d}
              className={cn(
                "rounded-md border bg-card p-2.5 transition-colors shadow-xs flex flex-col justify-between",
                view === "month" ? "min-h-28" : view === "day" ? "min-h-64" : "min-h-48",
                outside && "opacity-40 bg-slate-50/50",
                isToday && "border-2 border-[#151b54] bg-slate-50/30",
              )}
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold",
                      isToday
                        ? "bg-[#151b54] text-white px-1.5 py-0.5 rounded"
                        : "text-muted-foreground",
                    )}
                  >
                    {view === "day"
                      ? fmtDate(toIso(d, "12:00"))
                      : fmtDate(toIso(d, "12:00")).slice(0, 6)}
                  </span>
                  {items.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {items.length} {items.length === 1 ? "event" : "events"}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {items.map((b) => {
                    const bufferEnd = new Date(
                      new Date(b.end_at).getTime() + BUFFER_MINUTES * 60000,
                    );
                    const isApproved = b.status === "approved";

                    return (
                      <div key={b.id} className="space-y-0.5">
                        <div
                          onClick={() => setSelectedBooking(b)}
                          className={cn(
                            "rounded p-1.5 text-xs cursor-pointer transition-all hover:scale-[1.01]",
                            isApproved
                              ? "bg-[#151b54] text-white hover:bg-[#151b54]/90 shadow-xs"
                              : "border border-dashed border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100",
                          )}
                          title="Click to view event details"
                        >
                          <div className="font-bold flex items-center justify-between text-[11px]">
                            <span>
                              {fmtTime(b.start_at)} – {fmtTime(b.end_at)}
                            </span>
                            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-black/20 font-semibold">
                              {b.status}
                            </span>
                          </div>
                          <div className="truncate font-semibold mt-0.5 text-xs">{b.title}</div>
                          {venue === "all" && (
                            <div className="truncate text-[10px] opacity-80">{b.venues?.name}</div>
                          )}
                        </div>

                        {/* Visual 30-Minute Buffer Block */}
                        {isApproved && (
                          <div
                            className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 slot-buffer border border-slate-200 text-center font-medium"
                            title={`30-minute buffer enforced until ${fmtTime(bufferEnd.toISOString())}`}
                          >
                            Buffer until {fmtTime(bufferEnd.toISOString())}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {view === "day" && items.length === 0 && (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      No events scheduled for this day. Entire day is open.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        booking={selectedBooking}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
