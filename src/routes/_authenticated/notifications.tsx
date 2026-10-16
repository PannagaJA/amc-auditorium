import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Auditorium Booking" }, { name: "description", content: "Updates on your booking requests." }, { property: "og:title", content: "Notifications — Auditorium Booking" }, { property: "og:description", content: "Updates on your booking requests." }] }),
  component: Notifications,
});

function Notifications() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications", "list", me.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const markAll = async () => { await supabase.from("notifications").update({ is_read: true }).eq("user_id", me.id).eq("is_read", false); refresh(); };
  const mark = async (id: string) => { await supabase.from("notifications").update({ is_read: true }).eq("id", id); refresh(); };
  const del = async (id: string) => { await supabase.from("notifications").delete().eq("id", id); refresh(); };

  return (
    <div>
      <PageHeader title="Notifications"><Button variant="outline" onClick={markAll}>Mark all as read</Button></PageHeader>
      {q.data?.length === 0 ? <Empty text="No notifications yet." /> : (
        <div className="divide-y rounded-lg border bg-card">
          {(q.data ?? []).map((n) => (
            <div key={n.id} className={cn("flex flex-wrap items-start justify-between gap-3 p-4", !n.is_read && "bg-accent/50")}>
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm">{n.body}</div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</div>
              </div>
              <div className="flex gap-1">
                {!n.is_read && <Button size="sm" variant="ghost" onClick={() => mark(n.id)}>Mark read</Button>}
                <Button size="sm" variant="ghost" onClick={() => del(n.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
