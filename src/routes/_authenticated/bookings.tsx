import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_SELECT, type BookingRow, useMe } from "@/lib/data";
import { BookingCard, Empty, PageHeader } from "@/components/booking-ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "My bookings — Auditorium Booking" }, { name: "description", content: "All your auditorium booking requests." }, { property: "og:title", content: "My bookings — Auditorium Booking" }, { property: "og:description", content: "All your auditorium booking requests." }] }),
  component: MyBookings,
});

function MyBookings() {
  const me = useMe();
  const [tab, setTab] = useState("upcoming");
  const q = useQuery({
    queryKey: ["bookings", "mine", me.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("user_id", me.id).order("start_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BookingRow[];
    },
  });
  const now = Date.now();
  const list = (q.data ?? []).filter((b) =>
    tab === "upcoming" ? new Date(b.end_at).getTime() >= now && (b.status === "pending" || b.status === "approved")
    : tab === "past" ? new Date(b.end_at).getTime() < now
    : b.status === tab);

  return (
    <div>
      <PageHeader title="My bookings" desc="Track the status of your requests." />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          {["upcoming", "pending", "approved", "rejected", "cancelled", "past"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : list.length === 0 ? <Empty text="Nothing here." /> : (
        <div className="space-y-3">{list.map((b) => <BookingCard key={b.id} b={b} me={me} showRequester={false} />)}</div>
      )}
    </div>
  );
}
