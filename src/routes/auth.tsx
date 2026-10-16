import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hasAdmin, setupFirstAdmin } from "@/lib/admin.functions";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Auditorium Booking" },
      { name: "description", content: "Sign in to request and manage auditorium bookings." },
      { property: "og:title", content: "Sign in — Auditorium Booking" },
      { property: "og:description", content: "Sign in to request and manage auditorium bookings." },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot" | "setup">("signin");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const hasAdminFn = useServerFn(hasAdmin);
  const setupFn = useServerFn(setupFirstAdmin);
  const adminQ = useQuery({ queryKey: ["hasAdmin"], queryFn: () => hasAdminFn() });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("If that email exists, a reset link is on its way.");
        setMode("signin");
      } else {
        await setupFn({ data: { full_name: name, email, password } });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Administrator account created");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const needsSetup = adminQ.data && !adminQ.data.hasAdmin;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/amc-logo.png" alt="" className="mx-auto mb-2 h-14 w-auto" />
          <CardTitle className="text-brand-navy">
            {mode === "signin" ? "Sign in" : mode === "forgot" ? "Reset password" : "Create the first administrator"}
          </CardTitle>
          <CardDescription>
            {mode === "setup" ? "This one-time step sets up the admin who will add everyone else." : "Accounts are created by your administrator."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "setup" && (
              <div className="space-y-1.5"><Label htmlFor="n">Full name</Label><Input id="n" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {mode !== "forgot" && (
              <div className="space-y-1.5"><Label htmlFor="p">Password</Label><Input id="p" type="password" required minLength={mode === "setup" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create admin & sign in"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm">
            {mode === "signin" ? (
              <button className="text-primary hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>
            ) : (
              <button className="text-primary hover:underline" onClick={() => setMode("signin")}>Back to sign in</button>
            )}
            {needsSetup && mode !== "setup" && (
              <button className="text-muted-foreground hover:underline" onClick={() => setMode("setup")}>First time here? Set up the administrator</button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
