import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, ShieldAlert, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasAdmin, setupFirstAdmin } from "@/lib/admin.functions";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — AMC Auditorium Booking System" },
      {
        name: "description",
        content: "Sign in to AMC Engineering College Auditorium Booking Management System.",
      },
      { property: "og:title", content: "Sign In — AMC Auditorium Booking System" },
      {
        property: "og:description",
        content: "Sign in to AMC Engineering College Auditorium Booking Management System.",
      },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot" | "setup">("signin");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Signed in successfully");
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If that email is registered, password reset instructions have been sent.");
        setMode("signin");
      } else {
        await setupFn({ data: { full_name: name.trim(), email: email.trim(), password } });
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Administrator account provisioned successfully");
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* AMC Institutional Header */}
        <div className="text-center space-y-2">
          <div className="inline-block rounded-md bg-white p-3 border border-slate-200 shadow-xs">
            <img
              src="/amc-logo.png"
              alt="AMC Engineering College"
              className="mx-auto h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#151b54]">
            Auditorium Booking & Management System
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            AMC Engineering College (Autonomous)
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-lg font-semibold text-[#151b54]">
              {mode === "signin"
                ? "Sign In to Your Account"
                : mode === "forgot"
                  ? "Reset Account Password"
                  : "Initialize College Administrator"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {mode === "signin"
                ? "Enter your institutional email address and password."
                : mode === "forgot"
                  ? "Enter your registered email address to receive password reset instructions."
                  : "Initial setup: Create the primary administrator account for this college system."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "setup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullname" className="text-xs font-medium text-foreground">
                    Full Name & Title
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullname"
                      type="text"
                      required
                      placeholder="e.g. Dr. Rajesh Kumar, Admin"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Institutional Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="name@amc.edu.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">
                      Password
                    </Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-[#151b54] hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={mode === "setup" ? 8 : 1}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "setup" && (
                    <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#151b54] text-white hover:bg-[#151b54]/90 text-sm font-medium h-9"
                disabled={busy}
              >
                {busy
                  ? "Authenticating…"
                  : mode === "signin"
                    ? "Sign In"
                    : mode === "forgot"
                      ? "Send Reset Link"
                      : "Create Administrator & Sign In"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t pt-4 text-center">
            {mode === "forgot" ? (
              <button
                type="button"
                className="text-xs text-[#151b54] hover:underline font-medium"
                onClick={() => setMode("signin")}
              >
                Return to Sign In
              </button>
            ) : needsSetup && mode !== "setup" ? (
              <button
                type="button"
                className="text-xs text-amber-700 hover:underline font-medium flex items-center justify-center gap-1"
                onClick={() => setMode("setup")}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                First-time setup: Initialize College Administrator
              </button>
            ) : mode === "setup" ? (
              <button
                type="button"
                className="text-xs text-[#151b54] hover:underline font-medium"
                onClick={() => setMode("signin")}
              >
                Already initialized? Return to Sign In
              </button>
            ) : null}

            <p className="text-[11px] text-muted-foreground mt-2">
              Staff and Faculty accounts are provisioned by College Administration.
            </p>
          </CardFooter>
        </Card>

        {/* Footer Institutional Note */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>© {new Date().getFullYear()} AMC Engineering College. All rights reserved.</p>
          <p className="text-[11px] text-slate-400">
            Autonomous Institute Affiliated to VTU | Approved by AICTE | NAAC A+
          </p>
        </div>
      </div>
    </div>
  );
}
