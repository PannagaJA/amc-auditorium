import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Building2, CalendarDays, CalendarPlus, ClipboardCheck, History, LayoutDashboard, ListChecks, LogOut, Menu, Settings, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, ROLE_LABEL } from "@/lib/data";
import { Button } from "@/components/ui/button";
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
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel("live-" + me.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => qc.invalidateQueries({ queryKey: ["bookings"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  if (!me) return null;

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/book", label: "New booking", icon: CalendarPlus },
    { to: "/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/bookings", label: "My bookings", icon: ListChecks },
    ...(me.isAdmin || me.isApprover ? [{ to: "/approvals", label: "Approvals", icon: ClipboardCheck }] : []),
    { to: "/venues", label: "Auditoriums", icon: Building2 },
    ...(me.isAdmin ? [{ to: "/users", label: "Users", icon: Users }, { to: "/audit", label: "Activity log", icon: History }] : []),
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform md:static md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src="/amc-logo.png" alt="" className="h-9 w-auto" />
          <span className="font-semibold text-brand-navy">Auditorium Booking</span>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}>
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.to === "/notifications" && (unread.data ?? 0) > 0 && (
                <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread.data}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t p-4">
          <div className="text-sm font-medium">{me.profile.full_name || me.email}</div>
          <div className="text-xs text-muted-foreground">{me.role ? ROLE_LABEL[me.role] : "No role"}</div>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/20 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></Button>
          <span className="font-semibold">Auditorium Booking</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
