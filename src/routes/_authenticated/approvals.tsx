import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Filter, CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_SELECT, type BookingRow, useMe, venuesQuery } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { BookingCard, Empty, PageHeader } from "@/components/booking-ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Booking Approvals — AMC Auditorium Portal" },
      { name: "description", content: "Review and sanction pending auditorium requests." },
      { property: "og:title", content: "Booking Approvals — AMC Auditorium Portal" },
      { property: "og:description", content: "Review and decide on booking requests." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const me = useMe();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(10);

  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(15);

  const venuesQ = useQuery(venuesQuery);
  const venues = venuesQ.data ?? [];

  // Pending bookings query
  const q = useQuery({
    queryKey: ["bookings", "approvals", me.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as BookingRow[]).filter(
        (b) => me.isAdmin || b.venues?.approver_id === me.id,
      );
    },
  });

  // Approval history query
  const histQ = useQuery({
    queryKey: ["bookings", "approval-history"],
    enabled: tab === "history",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select(
          "*, actor:profiles!approvals_actor_id_fkey(full_name, email), bookings(title, venue_id, venues(name))",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        action: string;
        reason: string | null;
        created_at: string;
        actor: { full_name: string; email: string } | null;
        bookings: { title: string; venue_id: string; venues: { name: string } | null } | null;
      }[];
    },
  });

  const allPending = useMemo(() => {
    return (q.data ?? []).filter(
      (b) => b.status === "pending" && new Date(b.start_at) > new Date(),
    );
  }, [q.data]);

  // Filter pending
  const filteredPending = useMemo(() => {
    return allPending.filter((b) => {
      const matchVenue = venueFilter === "all" || b.venue_id === venueFilter;
      const matchSearch =
        search.trim() === "" ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.venues?.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.requester?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.requester?.email?.toLowerCase().includes(search.toLowerCase());
      return matchVenue && matchSearch;
    });
  }, [allPending, venueFilter, search]);

  const totalPending = filteredPending.length;
  const paginatedPending = useMemo(() => {
    const start = (pendingPage - 1) * pendingPageSize;
    return filteredPending.slice(start, start + pendingPageSize);
  }, [filteredPending, pendingPage, pendingPageSize]);

  // Filter history
  const allHistory = useMemo(() => histQ.data ?? [], [histQ.data]);
  const filteredHistory = useMemo(() => {
    return allHistory.filter((h) => {
      const matchAction = actionFilter === "all" || h.action === actionFilter;
      const matchSearch =
        search.trim() === "" ||
        h.bookings?.title?.toLowerCase().includes(search.toLowerCase()) ||
        h.actor?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        h.actor?.email?.toLowerCase().includes(search.toLowerCase()) ||
        (h.reason && h.reason.toLowerCase().includes(search.toLowerCase()));
      return matchAction && matchSearch;
    });
  }, [allHistory, actionFilter, search]);

  const totalHistory = filteredHistory.length;
  const paginatedHistory = useMemo(() => {
    const start = (histPage - 1) * histPageSize;
    return filteredHistory.slice(start, start + histPageSize);
  }, [filteredHistory, histPage, histPageSize]);

  if (!me.isAdmin && !me.isApprover) {
    return (
      <Empty text="Access restricted. Only College Administrators and designated Approvers (Principal / HOD) can view this section." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sanction & Approvals"
        desc={
          me.isAdmin
            ? "Central administrative review queue for all college auditoriums."
            : "Review booking proposals for auditoriums assigned to your department/office."
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab);
          setSearch("");
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="pending" className="text-xs font-semibold gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-700" />
              Pending Sanctions ({allPending.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-semibold gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Decision History
            </TabsTrigger>
          </TabsList>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {tab === "pending" ? (
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
                  <SelectValue placeholder="All Venues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Auditoriums</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9 w-full sm:w-32 text-xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {tab === "pending" ? (
          <div className="space-y-4">
            {q.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Loading pending requests...
              </div>
            ) : paginatedPending.length === 0 ? (
              <Empty
                text={
                  search || venueFilter !== "all"
                    ? "No pending bookings match the filter criteria."
                    : "No pending requests awaiting approval. All requests are up to date."
                }
              />
            ) : (
              <div className="space-y-3">
                {paginatedPending.map((b) => (
                  <BookingCard key={b.id} b={b} me={me} />
                ))}
              </div>
            )}

            <PaginationControls
              currentPage={pendingPage}
              totalItems={totalPending}
              pageSize={pendingPageSize}
              onPageChange={setPendingPage}
              onPageSizeChange={setPendingPageSize}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card overflow-x-auto shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70">
                    <TableHead className="text-xs font-semibold">Date & Time</TableHead>
                    <TableHead className="text-xs font-semibold">Event</TableHead>
                    <TableHead className="text-xs font-semibold">Auditorium</TableHead>
                    <TableHead className="text-xs font-semibold">Action</TableHead>
                    <TableHead className="text-xs font-semibold">Decided By</TableHead>
                    <TableHead className="text-xs font-semibold">Remarks / Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histQ.isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        Loading decision history...
                      </TableCell>
                    </TableRow>
                  ) : paginatedHistory.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        No decision history records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHistory.map((h) => {
                      const actionStyle =
                        h.action === "approved"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : h.action === "rejected"
                            ? "bg-rose-50 text-rose-800 border-rose-300"
                            : "bg-slate-100 text-slate-700 border-slate-300";

                      return (
                        <TableRow key={h.id} className="text-xs">
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {fmtDateTime(h.created_at)}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {h.bookings?.title || "Event"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.bookings?.venues?.name || "Auditorium"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`capitalize font-semibold ${actionStyle}`}
                            >
                              {h.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-foreground">
                            {h.actor?.full_name || h.actor?.email || "System"}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {h.reason || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <PaginationControls
              currentPage={histPage}
              totalItems={totalHistory}
              pageSize={histPageSize}
              onPageChange={setHistPage}
              onPageSizeChange={setHistPageSize}
              pageSizeOptions={[15, 30, 50]}
            />
          </div>
        )}
      </Tabs>
    </div>
  );
}
