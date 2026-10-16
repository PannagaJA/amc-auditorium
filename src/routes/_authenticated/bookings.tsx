import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Plus, Calendar, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BOOKING_SELECT, type BookingRow, useMe, venuesQuery } from "@/lib/data";
import { BookingCard, Empty, PageHeader } from "@/components/booking-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — AMC Auditorium Portal" },
      {
        name: "description",
        content:
          "Review and manage all your auditorium booking requests at AMC Engineering College.",
      },
      { property: "og:title", content: "My Bookings — AMC Auditorium Portal" },
      { property: "og:description", content: "All your auditorium booking requests." },
    ],
  }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const me = useMe();
  const [tab, setTab] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const venuesQ = useQuery(venuesQuery);
  const venues = venuesQ.data ?? [];

  const q = useQuery({
    queryKey: ["bookings", "mine", me.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .eq("user_id", me.id)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  const allBookings = q.data ?? [];
  const now = Date.now();

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: allBookings.length,
      upcoming: allBookings.filter(
        (b) =>
          new Date(b.end_at).getTime() >= now &&
          (b.status === "pending" || b.status === "approved"),
      ).length,
      pending: allBookings.filter((b) => b.status === "pending").length,
      approved: allBookings.filter((b) => b.status === "approved").length,
      rejected: allBookings.filter((b) => b.status === "rejected").length,
      cancelled: allBookings.filter((b) => b.status === "cancelled").length,
      past: allBookings.filter((b) => new Date(b.end_at).getTime() < now).length,
    };
  }, [allBookings, now]);

  // Filtered by tab, venue, and search term
  const filtered = useMemo(() => {
    return allBookings.filter((b) => {
      const matchSearch =
        search.trim() === "" ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.venues?.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.purpose.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      const matchVenue = venueFilter === "all" || b.venue_id === venueFilter;
      if (!matchVenue) return false;

      if (tab === "upcoming") {
        return (
          new Date(b.end_at).getTime() >= now && (b.status === "pending" || b.status === "approved")
        );
      }
      if (tab === "past") {
        return new Date(b.end_at).getTime() < now;
      }
      if (tab === "all") {
        return true;
      }
      return b.status === tab;
    });
  }, [allBookings, tab, venueFilter, search, now]);

  const totalItems = filtered.length;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Auditorium Bookings"
        desc="Track the review status of your event proposals, view approvals, and manage scheduled slots."
      >
        <Button asChild className="bg-[#151b54] text-white hover:bg-[#151b54]/90 gap-1.5 shadow-xs">
          <Link to="/book" search={{}}>
            <Plus className="h-4 w-4" />
            New Booking Request
          </Link>
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, auditorium, or purpose..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown Filter */}
          <Select
            value={tab}
            onValueChange={(val) => {
              setTab(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-48 text-xs font-medium">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bookings ({counts.all})</SelectItem>
              <SelectItem value="upcoming">Upcoming Events ({counts.upcoming})</SelectItem>
              <SelectItem value="pending">Pending Review ({counts.pending})</SelectItem>
              <SelectItem value="approved">Approved & Scheduled ({counts.approved})</SelectItem>
              <SelectItem value="rejected">Rejected Requests ({counts.rejected})</SelectItem>
              <SelectItem value="cancelled">Cancelled Slots ({counts.cancelled})</SelectItem>
              <SelectItem value="past">Past History ({counts.past})</SelectItem>
            </SelectContent>
          </Select>

          {/* Venue Dropdown Filter */}
          <Select
            value={venueFilter}
            onValueChange={(v) => {
              setVenueFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-48 text-xs font-medium">
              <SelectValue placeholder="All Auditoriums" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All Auditoriums</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
            Total records: <strong className="text-foreground">{totalItems}</strong>
          </span>
        </div>
      </div>

      {/* List content */}
      {q.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading your bookings...
        </div>
      ) : paginatedList.length === 0 ? (
        <Empty
          text={
            search
              ? "No bookings match your search query."
              : tab === "upcoming"
                ? "You have no upcoming auditorium bookings scheduled."
                : tab === "pending"
                  ? "You have no booking requests pending approval."
                  : "No booking records found in this category."
          }
          action={
            <Button asChild size="sm" className="bg-[#151b54] text-white">
              <Link to="/book" search={{}}>
                Request a Booking
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {paginatedList.map((b) => (
            <BookingCard key={b.id} b={b} me={me} showRequester={false} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <PaginationControls
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
}
