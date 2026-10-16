import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_SELECT, type BookingRow, useMe } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { BookingCard, Empty, PageHeader } from "@/components/booking-ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Auditorium Booking" }, { name: "description", content: "Review and decide on auditorium booking requests." }, { property: "og:title", content: "Approvals — Auditorium Booking" }, { property: "og:description", content: "Review and decide on booking requests." }] }),
  component: Approvals,
});

function Approvals() {
  const me = useMe();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const q = useQuery({
    queryKey: ["bookings", "approvals", me.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).order("start_at");
      if (error) throw error;
      return (data as unknown as BookingRow[]).filter((b) => me.isAdmin || b.venues?.approver_id === me.id);
    },
  });
  const hist = useQuery({
    queryKey: ["bookings", "approval-history"],
    enabled: tab === "history",
    queryFn: async () => {
      const { data } = await supabase.from("approvals").select("*, actor:profiles!approvals_actor_id_fkey(full_name), bookings(title)").order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as unknown as { id: string; action: string; reason: string | null; created_at: string; actor: { full_name: string } | null; bookings: { title: string } | null }[];
    },
  });

  if (!me.isAdmin && !me.isApprover) return <Empty text="Only approvers and administrators can view this page." />;
  const pending = (q.data ?? []).filter((b) => b.status === "pending" && new Date(b.start_at) > new Date());

  return (
    <div>
      <PageHeader title="Approvals" desc={me.isAdmin ? "All pending requests." : "Requests for auditoriums you approve."} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
      </Tabs>
      {tab === "pending" ? (
        pending.length === 0 ? <Empty text="No pending requests. You're all caught up." /> : <div className="space-y-3">{pending.map((b) => <BookingCard key={b.id} b={b} me={me} />)}</div>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {(hist.data ?? []).map((h) => (
            <div key={h.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
              <span><b className="capitalize">{h.action}</b> · {h.bookings?.title} {h.actor && <>by {h.actor.full_name}</>}{h.reason && <span className="text-muted-foreground"> — {h.reason}</span>}</span>
              <span className="text-muted-foreground">{fmtDateTime(h.created_at)}</span>
            </div>
          ))}
          {hist.data?.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No history yet.</div>}
        </div>
      )}
    </div>
  );
}
