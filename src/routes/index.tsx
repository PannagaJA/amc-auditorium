import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  ShieldCheck,
  Clock,
  Building2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AMC Auditorium Booking & Management Portal" },
      {
        name: "description",
        content:
          "Official Auditorium Booking & Management System of AMC Engineering College (Autonomous).",
      },
      { property: "og:title", content: "AMC Auditorium Booking & Management Portal" },
      { property: "og:description", content: "Auditorium booking, scheduling, and approvals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground flex flex-col justify-between">
      {/* Institutional Top Navbar */}
      <header className="border-b border-border bg-white shadow-xs sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-4">
            <img
              src="/logofinal.jpg"
              alt="AMC Institutions"
              className="h-12 w-auto object-contain rounded-xs"
            />
            <div className="hidden sm:block border-l border-slate-300 pl-4">
              <span className="text-base font-bold text-[#151b54] block leading-tight">
                Auditorium Management Portal
              </span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                Autonomous Institute · NAAC A+ Accredited
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              asChild
              className="bg-[#151b54] text-white hover:bg-[#151b54]/90 text-sm h-9 shadow-xs"
            >
              <Link to="/auth">Sign In to Portal</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24 space-y-16">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-[#151b54]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Official Campus Venue Management
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#151b54] sm:text-5xl leading-tight">
            Seamless Auditorium Booking & Institutional Event Management
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            A centralized platform for AMC Engineering College faculty, departments, and event
            managers to check live venue availability, request auditorium reservations, and receive
            administrative approvals with an automated 30-minute buffer interval between sessions.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              size="lg"
              asChild
              className="bg-[#151b54] text-white hover:bg-[#151b54]/90 text-sm font-semibold h-11 px-6 shadow-xs gap-2"
            >
              <Link to="/auth">
                Access Booking System <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-slate-300 text-sm font-medium h-11 px-6"
            >
              <Link to="/auth">View Schedules</Link>
            </Button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Mandatory 30-Min Buffer",
              desc: "Automatic 30-minute buffer intervals enforced after every booking in the database, preventing consecutive clashing and ensuring adequate stage turnover.",
            },
            {
              icon: ShieldCheck,
              title: "Institutional Sanction Workflow",
              desc: "Role-based approval hierarchy ensuring all auditorium proposals are reviewed by Principal, Vice Principal, HODs, or College Administration before confirmation.",
            },
            {
              icon: CalendarCheck,
              title: "Live Centralized Schedule",
              desc: "Consolidated day, week, and month calendar views displaying confirmed bookings, pending requests, and real-time hall availability across campus.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-white p-6 shadow-xs hover:border-slate-300 transition-all space-y-3"
            >
              <div className="inline-flex p-2.5 rounded-md bg-[#151b54]/5 text-[#151b54]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#151b54]">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Governance & Rules Summary */}
        <div className="rounded-lg border border-border bg-white p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="h-6 w-6 text-[#151b54]" />
            <h2 className="text-xl font-bold text-[#151b54]">Governing Booking Regulations</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-slate-600">
            <div className="flex items-start gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#151b54] mt-1.5 shrink-0" />
              <span>
                <strong>Advance Booking:</strong> Requests may be scheduled up to 180 days in
                advance of the event date.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#151b54] mt-1.5 shrink-0" />
              <span>
                <strong>Capacity Compliance:</strong> Expected attendees must not exceed the
                certified auditorium capacity.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#151b54] mt-1.5 shrink-0" />
              <span>
                <strong>Operating Hours:</strong> Events must strictly adhere to the defined venue
                opening and closing hours.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#151b54] mt-1.5 shrink-0" />
              <span>
                <strong>Rejection Transparency:</strong> Approving authorities must record an
                official reason for any booking denial.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-border bg-white py-8 px-6 text-center text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-slate-700">
          AMC Engineering College (Autonomous) — Auditorium Booking & Management Portal
        </p>
        <p>18th K.M. Bannerghatta Road, Kalkere, Bengaluru, Karnataka 560083</p>
        <p className="text-[11px] text-slate-400">
          Affiliated to Visvesvaraya Technological University (VTU) · Approved by AICTE · NAAC A+
          Accredited
        </p>
      </footer>
    </div>
  );
}
