import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auditorium Booking — Reserve campus venues" },
      { name: "description", content: "Request auditoriums, get Principal/HOD approval and check live availability with a 30-minute gap between events." },
      { property: "og:title", content: "Auditorium Booking — Reserve campus venues" },
      { property: "og:description", content: "Request auditoriums, get approvals and check live availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/amc-logo.png" alt="" className="h-10 w-auto" />
            <span className="text-lg font-semibold text-brand-navy">Auditorium Booking</span>
          </div>
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-brand-navy md:text-5xl">
          Book the right auditorium, without the back-and-forth.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Staff request a slot, the Principal or HOD approves it, and everyone sees the same live calendar.
        </p>
        <div className="mt-8"><Button size="lg" asChild><Link to="/auth">Sign in to book</Link></Button></div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { icon: CalendarCheck, t: "Live availability", d: "Day, week and month views for every auditorium." },
            { icon: ShieldCheck, t: "Approval workflow", d: "Requests go to the venue's approver with full history." },
            { icon: Clock, t: "30-minute buffer", d: "Clashing or back-to-back bookings are blocked automatically." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-lg border bg-card p-6">
              <I className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
