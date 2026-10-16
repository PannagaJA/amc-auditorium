import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, User, Lock, Building, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useMe } from "@/lib/data";
import { errMsg } from "@/lib/format";
import { isValidPhone } from "@/lib/validations";
import { PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — AMC Auditorium Portal" },
      {
        name: "description",
        content: "Update your institutional profile and security credentials.",
      },
      { property: "og:title", content: "Account Settings — AMC Auditorium Portal" },
      { property: "og:description", content: "Update profile and credentials." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(me.profile.full_name);
  const [phone, setPhone] = useState(me.profile.phone ?? "");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || name.trim().length > 100) {
      return toast.error("Full name must be between 2 and 100 characters.");
    }
    if (phone.trim() && !isValidPhone(phone)) {
      return toast.error(
        "Please enter a valid 10-digit phone number (e.g. 9876543210 or +91 9876543210).",
      );
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim() })
      .eq("id", me.id);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Profile updated successfully");
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("New password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: pw,
      current_password: cur,
    } as { password: string });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setCur("");
    setPw("");
    toast.success("Password changed successfully");
  }

  const roleDisplay = me.collegeRole
    ? ROLE_LABEL[me.collegeRole] || me.collegeRole
    : me.role
      ? ROLE_LABEL[me.role]
      : "Staff";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Account & Profile Settings"
        desc="Manage your institutional personal details and authentication credentials."
      />

      {/* Institutional Profile Card */}
      <Card className="border border-border shadow-xs bg-white">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-[#151b54]">
              Institutional Profile
            </CardTitle>
            <Badge
              variant="outline"
              className="bg-[#151b54]/10 text-[#151b54] font-semibold border-[#151b54]/30"
            >
              {roleDisplay}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Assigned role: <strong>{roleDisplay}</strong> | Department:{" "}
            <strong>
              {me.profile.departments?.name ??
                (me.departmentName && me.departmentName !== "General Administration"
                  ? me.departmentName
                  : "None / Central Administration")}
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instEmail" className="text-xs font-semibold text-muted-foreground">
                Institutional Email (Read Only)
              </Label>
              <Input
                id="instEmail"
                value={me.email}
                disabled
                className="bg-slate-50 text-slate-500 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                Full Name & Title *
              </Label>
              <Input
                id="fullName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneNum" className="text-xs font-semibold text-foreground">
                Contact Phone Number
              </Label>
              <Input
                id="phoneNum"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="text-sm"
              />
            </div>

            <Button
              disabled={busy}
              className="bg-[#151b54] text-white hover:bg-[#151b54]/90 text-xs h-9"
            >
              {busy ? "Saving…" : "Save Profile Details"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security & Password Card */}
      <Card className="border border-border shadow-xs bg-white">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#151b54]">Security & Password</CardTitle>
          <CardDescription className="text-xs">
            Change your account password regularly to keep institutional systems secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={savePw} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="curPw" className="text-xs font-semibold text-foreground">
                Current Password *
              </Label>
              <Input
                id="curPw"
                type="password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPw" className="text-xs font-semibold text-foreground">
                New Password (Minimum 8 characters) *
              </Label>
              <Input
                id="newPw"
                type="password"
                minLength={8}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                className="text-sm"
              />
            </div>

            <Button disabled={busy} variant="outline" className="text-xs h-9">
              {busy ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
