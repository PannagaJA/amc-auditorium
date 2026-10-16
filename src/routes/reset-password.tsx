import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Auditorium Booking" },
      {
        name: "description",
        content: "Choose a new password for your auditorium booking account.",
      },
      { property: "og:title", content: "Set a new password — Auditorium Booking" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-block rounded-md bg-white p-3 border border-slate-200 shadow-xs">
            <img
              src="/logofinal.jpg"
              alt="AMC Institutions"
              className="mx-auto h-16 w-auto object-contain rounded-xs"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#151b54]">
            Auditorium Booking & Management System
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            AMC Engineering College (Autonomous)
          </p>
        </div>

        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#151b54]">
              Set a new password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
