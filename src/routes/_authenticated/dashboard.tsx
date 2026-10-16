import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_SELECT, type BookingRow, useMe } from "@/lib/data";
import { BookingCard, Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Auditorium Booking" }, { name: "description", content: "Your bookings and approvals at a glance." }, { property: "og:title", content: "Dashboard — Auditorium Booking" }, { property: "og:description", content: "Your bookings and approvals at a glance." }] }),
  component: Dashboard,
});

function Dashboard() {
  const me = useMe();
  const q = useQuery({
    queryKey: ["bookings", "dashboard", me.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const [mine, upcoming, pending] = await Promise.all([
        supabase.from("bookings").select(BOOKING_SELECT).eq("user_id", me.id).gte("end_at", now).in("status", ["pending", "approved"]).order("start_at").limit(5),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "approved").gte("end_at", now),
        supabase.from("bookings").select(BOOKING_SELECT).eq("status", "pending").gte("start_at", now).order("start_at"),
      ]);
      const pend = ((pending.data ?? []) as unknown as BookingRow[]).filter((b) => me.isAdmin || (me.isApprover && b.venues?.approver_id === me.id));
      return { mine: (mine.data ?? []) as unknown as BookingRow[], upcoming: upcoming.count ?? 0, pending: pend };
    },
  });
  const d = q.data;

  return (
    <div>
      <PageHeader title={`Welcome, ${me.profile.full_name || "there"}`} desc="Here's what's coming up.">
        <Button asChild><Link to="/book">New booking</Link></Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="My upcoming bookings" value={d?.mine.length ?? "–"} />
        <Stat label="Approved events campus-wide" value={d?.upcoming ?? "–"} />
        {(me.isAdmin || me.isApprover) && <Stat label="Awaiting your decision" value={d?.pending.length ?? "–"} />}
      </div>
      {(me.isAdmin || me.isApprover) && (d?.pending.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Needs your approval</h2>
          <div className="space-y-3">{d!.pending.slice(0, 5).map((b) => <BookingCard key={b.id} b={b} me={me} />)}</div>
        </section>
      )}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">My upcoming bookings</h2>
        {d && d.mine.length === 0 ? <Empty text="You have no upcoming bookings." /> : (
          <div className="space-y-3">{d?.mine.map((b) => <BookingCard key={b.id} b={b} me={me} showRequester={false} />)}</div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="p-5"><div className="text-3xl font-bold text-brand-navy">{value}</div><div className="text-sm text-muted-foreground">{label}</div></CardContent></Card>;
}
