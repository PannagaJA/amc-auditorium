import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { Empty, PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — AMC Auditorium Portal" },
      { name: "description", content: "Booking status updates, approvals, and reminders." },
      { property: "og:title", content: "Notifications — AMC Auditorium Portal" },
      { property: "og:description", content: "Updates on your booking requests." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const q = useQuery({
    queryKey: ["notifications", "list", me.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allNotifications = q.data ?? [];
  const unreadCount = allNotifications.filter((n) => !n.is_read).length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const markAll = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", me.id)
      .eq("is_read", false);
    refresh();
  };

  const mark = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    refresh();
  };

  const del = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    refresh();
  };

  const filtered = useMemo(() => {
    if (filter === "unread") return allNotifications.filter((n) => !n.is_read);
    return allNotifications;
  }, [allNotifications, filter]);

  const totalItems = filtered.length;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        desc="Alerts on booking sanctions, approvals, rejections, and schedule updates."
      >
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5 text-xs">
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as typeof filter);
            setPage(1);
          }}
        >
          <TabsList className="bg-slate-100 p-0.5">
            <TabsTrigger value="all" className="text-xs">
              All ({allNotifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {q.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading notifications...
        </div>
      ) : paginatedList.length === 0 ? (
        <Empty
          text={
            filter === "unread"
              ? "You're all caught up! No unread notifications."
              : "No notifications found in your account."
          }
        />
      ) : (
        <div className="divide-y rounded-md border border-border bg-card shadow-xs">
          {paginatedList.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 p-4 transition-colors",
                !n.is_read ? "bg-amber-50/40" : "hover:bg-slate-50/50",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{n.title}</span>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-[#151b54]" />}
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">{n.body}</p>
                <span className="text-[11px] text-slate-400 block pt-0.5">
                  {fmtDateTime(n.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {!n.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => mark(n.id)}
                  >
                    Mark read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-slate-400 hover:text-destructive"
                  onClick={() => del(n.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
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
