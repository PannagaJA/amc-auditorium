import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useMe } from "@/lib/data";
import { errMsg } from "@/lib/format";
import { PageHeader } from "@/components/booking-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Auditorium Booking" }, { name: "description", content: "Update your profile and password." }, { property: "og:title", content: "Settings — Auditorium Booking" }, { property: "og:description", content: "Update your profile and password." }] }),
  component: Settings,
});

function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(me.profile.full_name);
  const [phone, setPhone] = useState(me.profile.phone ?? "");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Name is required");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim(), phone: phone.trim() }).eq("id", me.id);
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("New password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as { password: string });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    setCur(""); setPw("");
    toast.success("Password changed");
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" desc={`${me.email} · ${me.role ? ROLE_LABEL[me.role] : ""}${me.profile.departments ? ` · ${me.profile.departments.name}` : ""}`} />
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <Button disabled={busy}>Save profile</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={savePw} className="space-y-3">
            <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
            <Button disabled={busy}>Change password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
