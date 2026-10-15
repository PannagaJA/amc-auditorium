export const TZ = "Asia/Kolkata";
export const BUFFER_MINUTES = 30;

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export const fmtDate = (d: string | Date) => dateFmt.format(new Date(d));
export const fmtTime = (d: string | Date) => timeFmt.format(new Date(d));
export const fmtDateTime = (d: string | Date) => `${fmtDate(d)}, ${fmtTime(d)}`;
export const fmtRange = (s: string, e: string) => `${fmtDate(s)}, ${fmtTime(s)} – ${fmtTime(e)}`;
/** YYYY-MM-DD in IST */
export const dayKey = (d: string | Date) => keyFmt.format(new Date(d));
/** HH:MM (24h) in IST */
export const hm = (d: string | Date) => hmFmt.format(new Date(d));
/** Build an ISO timestamp from an IST date + HH:MM */
export const toIso = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();
export const todayKey = () => dayKey(new Date());
export const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fmtHM = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
};
/** Start/end ISO bounds of an IST day */
export const dayBounds = (key: string) => ({ from: toIso(key, "00:00"), to: new Date(new Date(toIso(key, "00:00")).getTime() + 86400000).toISOString() });
export const addDays = (key: string, n: number) => dayKey(new Date(new Date(toIso(key, "12:00")).getTime() + n * 86400000));

/** True if [s1,e1+buf) overlaps [s2,e2+buf) */
export function conflictsWithBuffer(s1: string, e1: string, s2: string, e2: string) {
  const b = BUFFER_MINUTES * 60000;
  const a1 = new Date(s1).getTime(), a2 = new Date(e1).getTime() + b;
  const c1 = new Date(s2).getTime(), c2 = new Date(e2).getTime() + b;
  return a1 < c2 && c1 < a2;
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong. Please try again.";
}
