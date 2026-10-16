import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, ShieldAlert, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Activity Audit Logs — AMC Auditorium Portal" },
      {
        name: "description",
        content: "Auditable administrative log of all booking, venue, and user operations.",
      },
      { property: "og:title", content: "Activity Audit Logs — AMC Auditorium Portal" },
      { property: "og:description", content: "Audit log of all actions." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const me = useMe();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const q = useQuery({
    queryKey: ["audit"],
    enabled: me.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, actor:profiles!audit_logs_actor_id_fkey(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        action: string;
        entity: string;
        details: Record<string, unknown>;
        created_at: string;
        actor: { full_name: string; email: string } | null;
      }[];
    },
  });

  const allLogs = useMemo(() => q.data ?? [], [q.data]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((a) => {
      const matchEntity = entityFilter === "all" || a.entity === entityFilter;
      const detailsStr = JSON.stringify(a.details || {});
      const matchSearch =
        search.trim() === "" ||
        a.action.toLowerCase().includes(search.toLowerCase()) ||
        a.actor?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.actor?.email?.toLowerCase().includes(search.toLowerCase()) ||
        detailsStr.toLowerCase().includes(search.toLowerCase());

      return matchEntity && matchSearch;
    });
  }, [allLogs, entityFilter, search]);

  const totalItems = filteredLogs.length;
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  if (!me.isAdmin) {
    return (
      <Empty text="Access restricted. Only College Administrators can inspect system activity logs." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Activity & Audit Logs"
        desc="Immutable institutional audit trail of booking creations, approvals, rejections, venue modifications, and user changes."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="relative flex-1 w-full max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by action, user, or details..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={entityFilter}
            onValueChange={(val) => {
              setEntityFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="booking">Booking Events</SelectItem>
              <SelectItem value="venue">Venue Events</SelectItem>
              <SelectItem value="user">User Events</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-md border border-border bg-card overflow-x-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70">
              <TableHead className="text-xs font-semibold">Timestamp (IST)</TableHead>
              <TableHead className="text-xs font-semibold">Action Performed</TableHead>
              <TableHead className="text-xs font-semibold">Actor</TableHead>
              <TableHead className="text-xs font-semibold">Entity Type</TableHead>
              <TableHead className="text-xs font-semibold">Operation Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  Loading audit logs...
                </TableCell>
              </TableRow>
            ) : paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  No activity log entries found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((a) => (
                <TableRow key={a.id} className="text-xs">
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fmtDateTime(a.created_at)}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    <Badge variant="outline" className="font-mono text-[11px] bg-slate-50">
                      {a.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {a.actor?.full_name || a.actor?.email || "System Service"}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{a.entity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                    {Object.entries(a.details ?? {})
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[15, 30, 50]}
      />
    </div>
  );
}
