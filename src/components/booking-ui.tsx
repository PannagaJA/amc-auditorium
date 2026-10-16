import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, fmtRange } from "@/lib/format";
import type { BookingRow, BookingStatus, Me } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS_CLS: Record<BookingStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant="outline" className={cn("capitalize", STATUS_CLS[status])}>{status}</Badge>;
}

export function canDecide(me: Me, b: BookingRow) {
  return b.status === "pending" && (me.isAdmin || (me.isApprover && b.venues?.approver_id === me.id));
}

export function BookingCard({ b, me, showRequester = true }: { b: BookingRow; me: Me; showRequester?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(ok);
    refresh();
  }

  const canCancel = (b.status === "pending" || b.status === "approved") && (b.user_id === me.id || me.isAdmin) && new Date(b.end_at) > new Date();

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{b.title}</div>
          <div className="text-sm text-muted-foreground">{b.venues?.name} · {fmtRange(b.start_at, b.end_at)}</div>
          {showRequester && <div className="text-sm text-muted-foreground">By {b.requester?.full_name || b.requester?.email} · {b.attendees} attendees</div>}
        </div>
        <StatusBadge status={b.status} />
      </div>
      <p className="mt-2 text-sm">{b.purpose}</p>
      {b.facilities.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{b.facilities.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</div>}
      {b.rejection_reason && <p className="mt-2 text-sm text-destructive">Reason: {b.rejection_reason}</p>}
      {(canDecide(me, b) || canCancel) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canDecide(me, b) && (
            <>
              <Button size="sm" disabled={busy} onClick={() => run(() => supabase.rpc("approve_booking", { _booking: b.id }), "Booking approved")}>Approve</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>Reject</Button>
            </>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy}
              onClick={() => { if (confirm("Cancel this booking?")) run(() => supabase.rpc("cancel_booking", { _booking: b.id }), "Booking cancelled"); }}>
              Cancel booking
            </Button>
          )}
        </div>
      )}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject "{b.title}"</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection (shared with the requester)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Back</Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 3}
              onClick={async () => { await run(() => supabase.rpc("reject_booking", { _booking: b.id, _reason: reason }), "Booking rejected"); setRejectOpen(false); }}>
              Reject booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
