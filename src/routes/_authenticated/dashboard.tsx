import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarCheck,
  CalendarPlus,
  Clock,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BOOKING_SELECT,
  type BookingRow,
  useMe,
  venuesQuery,
  type Venue,
  ROLE_LABEL,
} from "@/lib/data";
import { dayBounds, fmtDateTime, fmtHM, fmtRange, fmtTime, todayKey } from "@/lib/format";
import { BookingCard, Empty, PageHeader, StatusBadge } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AMC Auditorium Booking Portal" },
      {
        name: "description",
        content: "Auditorium schedules, availability, and bookings at AMC Engineering College.",
      },
      { property: "og:title", content: "Dashboard — AMC Auditorium Booking Portal" },
      { property: "og:description", content: "Auditorium schedules and bookings." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const me = useMe();
  const venuesQ = useQuery(venuesQuery);
  const venues = venuesQ.data ?? [];

  // Fetch Dashboard data
  const dashQ = useQuery({
    queryKey: ["dashboard", me.id, me.role],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const today = todayKey();
      const { from: todayStart, to: todayEnd } = dayBounds(today);

      const [mineRes, todayRes, upcomingApprovedRes, pendingRes] = await Promise.all([
        // My active bookings (staff & all users)
        supabase
          .from("bookings")
          .select(BOOKING_SELECT)
          .eq("user_id", me.id)
          .gte("end_at", nowIso)
          .in("status", ["pending", "approved"])
          .order("start_at")
          .limit(10),

        // Today's campus bookings
        supabase
          .from("bookings")
          .select(BOOKING_SELECT)
          .gte("start_at", todayStart)
          .lt("start_at", todayEnd)
          .eq("status", "approved")
          .order("start_at"),

        // Upcoming approved campus-wide events
        supabase
          .from("bookings")
          .select(BOOKING_SELECT)
          .eq("status", "approved")
          .gte("end_at", nowIso)
          .order("start_at")
          .limit(10),

        // Pending approval queue
        supabase
          .from("bookings")
          .select(BOOKING_SELECT)
          .eq("status", "pending")
          .gte("start_at", nowIso)
          .order("start_at"),
      ]);

      const allPending = (pendingRes.data ?? []) as unknown as BookingRow[];
      // Filter pending requests for this user's authority
      const relevantPending = allPending.filter(
        (b) => me.isAdmin || (me.isApprover && b.venues?.approver_id === me.id),
      );

      return {
        myBookings: (mineRes.data ?? []) as unknown as BookingRow[],
        todayBookings: (todayRes.data ?? []) as unknown as BookingRow[],
        upcomingApproved: (upcomingApprovedRes.data ?? []) as unknown as BookingRow[],
        pendingApprovals: relevantPending,
        totalPendingCount: allPending.length,
      };
    },
  });

  const data = dashQ.data;

  // Compute live auditorium availability status right now
  const now = new Date();
  const getVenueCurrentStatus = (v: Venue) => {
    if (v.status !== "active")
      return {
        status: v.status,
        label: v.status === "maintenance" ? "Under Maintenance" : "Inactive",
        variant: "outline" as const,
      };

    // Check if within operating hours
    const [openH, openM] = v.open_time.split(":").map(Number);
    const [closeH, closeM] = v.close_time.split(":").map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (nowMinutes < openMinutes || nowMinutes >= closeMinutes) {
      return { status: "closed", label: "Closed for Today", variant: "outline" as const };
    }

    // Check if an approved event is currently occupying the venue
    const currentEvent = (data?.todayBookings ?? []).find((b) => {
      if (b.venue_id !== v.id) return false;
      const s = new Date(b.start_at).getTime();
      const e = new Date(b.end_at).getTime();
      return now.getTime() >= s && now.getTime() <= e;
    });

    if (currentEvent) {
      return {
        status: "occupied",
        label: `In Session: ${currentEvent.title}`,
        variant: "secondary" as const,
      };
    }

    return { status: "available", label: "Available Now", variant: "default" as const };
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <PageHeader
        title={`Welcome, ${me.profile.full_name || "Colleague"}`}
        desc={`AMC Engineering College — Auditorium Management (${ROLE_LABEL[me.collegeRole] || me.collegeRole || "Faculty / Staff"}${
          me.profile.departments?.name || me.departmentName
            ? ` • ${me.profile.departments?.name || me.departmentName}`
            : ""
        })`}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            className="bg-[#151b54] text-white hover:bg-[#151b54]/90 gap-1.5 shadow-xs"
          >
            <Link to="/book" search={{}}>
              <CalendarPlus className="h-4 w-4" />
              Book Auditorium
            </Link>
          </Button>
          {me.isAdmin && (
            <Button asChild variant="outline" className="border-slate-300">
              <Link to="/venues">Manage Auditoriums</Link>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* KPI Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {me.isAdmin ? (
          <>
            <StatCard
              title="Total Auditoriums"
              value={venues.length}
              desc={`${venues.filter((v) => v.status === "active").length} Active on Campus`}
              icon={Building2}
            />
            <StatCard
              title="Today's Events"
              value={data?.todayBookings.length ?? 0}
              desc="Approved bookings today"
              icon={CalendarCheck}
            />
            <StatCard
              title="Pending Approvals"
              value={data?.pendingApprovals.length ?? 0}
              desc="Awaiting administrative sanction"
              icon={AlertTriangle}
              highlight={(data?.pendingApprovals.length ?? 0) > 0}
            />
            <StatCard
              title="Upcoming Campus Events"
              value={data?.upcomingApproved.length ?? 0}
              desc="Scheduled in future dates"
              icon={Clock}
            />
          </>
        ) : me.isApprover ? (
          <>
            <StatCard
              title="Awaiting Your Approval"
              value={data?.pendingApprovals.length ?? 0}
              desc="Auditorium booking requests"
              icon={AlertTriangle}
              highlight={(data?.pendingApprovals.length ?? 0) > 0}
            />
            <StatCard
              title="Today's Campus Bookings"
              value={data?.todayBookings.length ?? 0}
              desc="Approved events today"
              icon={CalendarCheck}
            />
            <StatCard
              title="Upcoming Approved Events"
              value={data?.upcomingApproved.length ?? 0}
              desc="Scheduled campus events"
              icon={Clock}
            />
            <StatCard
              title="My Event Requests"
              value={data?.myBookings.length ?? 0}
              desc="Personal requests"
              icon={Users}
            />
          </>
        ) : (
          <>
            <StatCard
              title="Active Auditoriums"
              value={venues.filter((v) => v.status === "active").length}
              desc="Available for bookings"
              icon={Building2}
            />
            <StatCard
              title="My Upcoming Bookings"
              value={data?.myBookings.filter((b) => b.status === "approved").length ?? 0}
              desc="Approved & confirmed"
              icon={CalendarCheck}
            />
            <StatCard
              title="My Pending Requests"
              value={data?.myBookings.filter((b) => b.status === "pending").length ?? 0}
              desc="Awaiting sanction"
              icon={Clock}
            />
            <StatCard
              title="Total Bookings Made"
              value={data?.myBookings.length ?? 0}
              desc="Active & requested"
              icon={Users}
            />
          </>
        )}
      </div>

      {/* Approvals Action Queue (For Admin & Principal/HOD) */}
      {(me.isAdmin || me.isApprover) && (data?.pendingApprovals.length ?? 0) > 0 && (
        <section className="rounded-md border border-amber-300 bg-amber-50/50 p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
              <div>
                <h2 className="font-bold text-[#151b54] text-base">
                  Action Required: Pending Booking Approvals ({data?.pendingApprovals.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Review and sanction booking requests. Rejection requires a mandatory reason.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-amber-400 bg-white text-xs w-full sm:w-auto"
            >
              <Link to="/approvals">View All Approvals</Link>
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {data?.pendingApprovals.slice(0, 4).map((b) => (
              <BookingCard key={b.id} b={b} me={me} />
            ))}
          </div>
        </section>
      )}

      {/* Live Venue Availability Today (Admin and Staff) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#151b54]">
              Auditorium Status & Live Availability
            </h2>
            <p className="text-xs text-muted-foreground">
              Current status and operating hours across campus venues.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs gap-1 text-[#151b54]">
            <Link to="/venues">
              All Auditoriums <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {venues.length === 0 ? (
          <Empty
            text="No auditoriums configured yet."
            action={
              me.isAdmin ? (
                <Button asChild size="sm" className="bg-[#151b54] text-white">
                  <Link to="/venues">Add Auditorium</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => {
              const avail = getVenueCurrentStatus(v);
              return (
                <Card
                  key={v.id}
                  className="border border-border shadow-xs hover:border-slate-300 transition-colors"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold text-foreground truncate">
                        {v.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium shrink-0 ${
                          avail.status === "available"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : avail.status === "occupied"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        {avail.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>
                        Capacity: <strong className="text-foreground">{v.capacity} seats</strong>
                      </span>
                      <span>
                        Hours: {fmtHM(v.open_time)} – {fmtHM(v.close_time)}
                      </span>
                    </div>
                    {v.location && <div className="truncate">Location: {v.location}</div>}
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-[11px] text-slate-500">30-min buffer enforced</span>
                      {v.status === "active" && (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5">
                          <Link to="/book" search={{ venue: v.id }}>
                            Book Slot
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Staff: My Upcoming Bookings & History */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#151b54]">My Upcoming Bookings</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/bookings">View All</Link>
            </Button>
          </div>
          {data?.myBookings.length === 0 ? (
            <Empty
              text="You have no active or upcoming bookings."
              action={
                <Button asChild size="sm" className="bg-[#151b54] text-white">
                  <Link to="/book" search={{}}>
                    Request New Booking
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {data?.myBookings.slice(0, 3).map((b) => (
                <BookingCard key={b.id} b={b} me={me} showRequester={false} />
              ))}
            </div>
          )}
        </section>

        {/* Today's Schedule & Campus Events */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#151b54]">Today's Confirmed Schedule</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/calendar">Full Calendar</Link>
            </Button>
          </div>
          {data?.todayBookings.length === 0 ? (
            <Empty text="No approved events scheduled for today across campus." />
          ) : (
            <div className="divide-y rounded-md border border-border bg-card">
              {data?.todayBookings.map((b) => (
                <div key={b.id} className="p-3.5 text-sm flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">{b.title}</span>
                    <span className="text-xs text-muted-foreground block">
                      {b.venues?.name} · {fmtTime(b.start_at)} – {fmtTime(b.end_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Organized by {b.requester?.full_name || b.requester?.email} ({b.attendees}{" "}
                      attendees)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 shrink-0"
                  >
                    Approved
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  desc,
  icon: Icon,
  highlight = false,
}: {
  title: string;
  value: number | string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`border shadow-xs ${highlight ? "border-amber-300 bg-amber-50/40" : "border-border bg-card"}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <Icon className={`h-4 w-4 ${highlight ? "text-amber-700" : "text-[#151b54]"}`} />
        </div>
        <div
          className={`mt-2 text-3xl font-bold tracking-tight ${highlight ? "text-amber-800" : "text-[#151b54]"}`}
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
