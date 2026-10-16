import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Activity log — Auditorium Booking" }, { name: "description", content: "Who did what, and when." }, { property: "og:title", content: "Activity log — Auditorium Booking" }, { property: "og:description", content: "Who did what, and when." }] }),
  component: Audit,
});

function Audit() {
  const me = useMe();
  const q = useQuery({
    queryKey: ["audit"],
    enabled: me.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*, actor:profiles!audit_logs_actor_id_fkey(full_name, email)").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as unknown as { id: string; action: string; entity: string; details: Record<string, unknown>; created_at: string; actor: { full_name: string; email: string } | null }[];
    },
  });
  if (!me.isAdmin) return <Empty text="Only administrators can view the activity log." />;
  return (
    <div>
      <PageHeader title="Activity log" desc="The latest 300 actions." />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {(q.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap">{fmtDateTime(a.created_at)}</TableCell>
                <TableCell>{a.actor?.full_name || a.actor?.email || "System"}</TableCell>
                <TableCell>{a.action}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{Object.entries(a.details ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
