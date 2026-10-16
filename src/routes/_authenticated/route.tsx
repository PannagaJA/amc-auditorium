import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  Users,
  Shield,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, ROLE_LABEL } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: "/auth" });
    if (!me.profile.is_active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: Shell,
});

function Shell() {
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("live-" + me.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () =>
        qc.invalidateQueries({ queryKey: ["bookings"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, qc]);

  if (!me) return null;

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/book", label: "New Booking", icon: CalendarPlus },
    { to: "/calendar", label: "Calendar Schedule", icon: CalendarDays },
    { to: "/bookings", label: "My Bookings", icon: ListChecks },
    ...(me.isAdmin || me.isApprover
      ? [{ to: "/approvals", label: "Approvals", icon: ClipboardCheck }]
      : []),
    { to: "/venues", label: "Auditoriums", icon: Building2 },
    ...(me.isAdmin
      ? [
          { to: "/users", label: "User Management", icon: Users },
          { to: "/audit", label: "Activity Logs", icon: History },
        ]
      : []),
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleDisplay = me.collegeRole
    ? ROLE_LABEL[me.collegeRole] || me.collegeRole
    : me.role
      ? ROLE_LABEL[me.role]
      : "Staff";

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-white transition-transform md:static md:translate-x-0 flex flex-col justify-between shadow-xs",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div>
          {/* Institution Header */}
          <div className="flex items-center justify-between border-b border-border p-4 bg-white">
            <Link to="/dashboard" className="flex items-center gap-3">
              <img
                src="/amc-logo.png"
                alt="AMC College Logo"
                className="h-10 w-auto object-contain"
              />
              <div>
                <span className="font-bold text-sm tracking-tight text-[#151b54] block leading-tight">
                  AMC Auditorium
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block">
                  Management Portal
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 p-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-[#151b54] font-medium transition-colors"
                activeProps={{
                  className:
                    "bg-[#151b54]/10 text-[#151b54] font-semibold border-l-2 border-[#151b54] rounded-l-none",
                }}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{n.label}</span>
                {n.to === "/notifications" && (unread.data ?? 0) > 0 && (
                  <span className="rounded-full bg-[#151b54] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {unread.data}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="border-t border-border p-4 bg-slate-50/70">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {me.profile.full_name || me.email}
              </div>
              <div className="text-xs text-muted-foreground truncate">{me.email}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 bg-white border-slate-300 font-semibold text-[#151b54]"
                >
                  {roleDisplay}
                </Badge>
                {(() => {
                  const dept = me.profile.departments?.name || me.departmentName;
                  if (!dept || dept === "General Administration") return null;
                  return (
                    <span
                      className="text-[11px] text-muted-foreground truncate max-w-[120px]"
                      title={dept}
                    >
                      {dept}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full h-8 text-xs font-medium text-slate-700 hover:text-destructive hover:bg-white"
            onClick={signOut}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-border bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <img src="/amc-logo.png" alt="AMC" className="h-7 w-auto" />
            <span className="font-semibold text-sm text-[#151b54]">Auditorium Portal</span>
          </div>

          <Link to="/notifications" className="relative p-1">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {(unread.data ?? 0) > 0 && (
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#151b54]" />
            )}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
