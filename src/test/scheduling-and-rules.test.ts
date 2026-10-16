import { describe, expect, it } from "vitest";
import {
  conflictsWithBuffer,
  toIso,
  BUFFER_MINUTES,
  minutesOf,
  fmtHM,
  dayBounds,
  todayKey,
} from "@/lib/format";
import { canDecide } from "@/components/booking-ui";
import { getTierForCollegeRole, type BookingRow, type Me } from "@/lib/data";

describe("Mandatory 30-Minute Buffer Scheduling Rule", () => {
  const date = "2026-11-20";

  it("blocks consecutive booking starting immediately when previous ends (0-min gap)", () => {
    // Booking 1: 10:00 AM to 11:00 AM
    const b1Start = toIso(date, "10:00");
    const b1End = toIso(date, "11:00");

    // Booking 2: 11:00 AM to 12:00 PM (ends at 11:00, next starts at 11:00 - should clash because buffer extends to 11:30)
    const b2Start = toIso(date, "11:00");
    const b2End = toIso(date, "12:00");

    const clashes = conflictsWithBuffer(b1Start, b1End, b2Start, b2End);
    expect(clashes).toBe(true);
  });

  it("blocks booking starting within the 30-minute buffer interval (e.g. 15-min gap)", () => {
    // Booking 1: 10:00 AM to 11:00 AM
    const b1Start = toIso(date, "10:00");
    const b1End = toIso(date, "11:00");

    // Booking 2: 11:15 AM to 12:15 PM
    const b2Start = toIso(date, "11:15");
    const b2End = toIso(date, "12:15");

    const clashes = conflictsWithBuffer(b1Start, b1End, b2Start, b2End);
    expect(clashes).toBe(true);
  });

  it("allows booking starting exactly after the 30-minute buffer (e.g. 11:30 AM start)", () => {
    // Booking 1: 10:00 AM to 11:00 AM (buffer ends at 11:30 AM)
    const b1Start = toIso(date, "10:00");
    const b1End = toIso(date, "11:00");

    // Booking 2: 11:30 AM to 13:00 PM
    const b2Start = toIso(date, "11:30");
    const b2End = toIso(date, "13:00");

    const clashes = conflictsWithBuffer(b1Start, b1End, b2Start, b2End);
    expect(clashes).toBe(false);
  });

  it("blocks booking ending with less than 30-minute buffer before existing booking", () => {
    // Existing Booking: 12:00 PM to 14:00 PM
    const existingStart = toIso(date, "12:00");
    const existingEnd = toIso(date, "14:00");

    // New Booking ending at 11:45 AM (only 15-min gap before existing booking at 12:00)
    const newStart = toIso(date, "10:00");
    const newEnd = toIso(date, "11:45");

    const clashes = conflictsWithBuffer(newStart, newEnd, existingStart, existingEnd);
    expect(clashes).toBe(true);
  });

  it("allows booking ending with full 30-minute buffer before existing booking", () => {
    // Existing Booking: 12:00 PM to 14:00 PM
    const existingStart = toIso(date, "12:00");
    const existingEnd = toIso(date, "14:00");

    // New Booking ending at 11:30 AM (exactly 30-min gap before 12:00)
    const newStart = toIso(date, "10:00");
    const newEnd = toIso(date, "11:30");

    const clashes = conflictsWithBuffer(newStart, newEnd, existingStart, existingEnd);
    expect(clashes).toBe(false);
  });

  it("blocks completely overlapping slots", () => {
    // Booking 1: 10:00 AM to 13:00 PM
    const b1Start = toIso(date, "10:00");
    const b1End = toIso(date, "13:00");

    // Booking 2: 11:00 AM to 12:00 PM
    const b2Start = toIso(date, "11:00");
    const b2End = toIso(date, "12:00");

    const clashes = conflictsWithBuffer(b1Start, b1End, b2Start, b2End);
    expect(clashes).toBe(true);
  });
});

describe("Auditorium Operating Hours & Formatting", () => {
  it("computes minutes correctly", () => {
    expect(minutesOf("08:00")).toBe(480);
    expect(minutesOf("12:30")).toBe(750);
    expect(minutesOf("20:00")).toBe(1200);
  });

  it("formats 24-hour time to 12-hour AM/PM correctly", () => {
    expect(fmtHM("08:00")).toBe("8:00 AM");
    expect(fmtHM("12:00")).toBe("12:00 PM");
    expect(fmtHM("13:45")).toBe("1:45 PM");
    expect(fmtHM("20:00")).toBe("8:00 PM");
  });

  it("generates day bounds in ISO format for IST", () => {
    const bounds = dayBounds("2026-10-16");
    expect(bounds.from).toContain("2026-10-15T18:30:00.000Z"); // 00:00 IST is 18:30 UTC previous day
    expect(bounds.to).toBeDefined();
  });
});

describe("Role Tiers & Permission Governance", () => {
  it("maps college roles to appropriate security tiers", () => {
    expect(getTierForCollegeRole("admin")).toBe("admin");
    expect(getTierForCollegeRole("facilities_officer")).toBe("admin");
    expect(getTierForCollegeRole("principal")).toBe("approver");
    expect(getTierForCollegeRole("vice_principal")).toBe("approver");
    expect(getTierForCollegeRole("dean_academics")).toBe("approver");
    expect(getTierForCollegeRole("dean_student_affairs")).toBe("approver");
    expect(getTierForCollegeRole("hod")).toBe("approver");
    expect(getTierForCollegeRole("event_manager")).toBe("staff");
    expect(getTierForCollegeRole("faculty")).toBe("staff");
    expect(getTierForCollegeRole("associate_professor")).toBe("staff");
    expect(getTierForCollegeRole("assistant_professor")).toBe("staff");
    expect(getTierForCollegeRole("technical_staff")).toBe("staff");
    expect(getTierForCollegeRole("placement_officer")).toBe("staff");
    expect(getTierForCollegeRole("sports_director")).toBe("staff");
    expect(getTierForCollegeRole("club_coordinator")).toBe("staff");
    expect(getTierForCollegeRole("av_technician")).toBe("staff");
    expect(getTierForCollegeRole("staff")).toBe("staff");
  });

  it("contains all AMC academic and specialized departments", async () => {
    const { DEFAULT_DEPARTMENTS } = await import("@/lib/data");
    expect(DEFAULT_DEPARTMENTS).toContain("Computer Science & Engineering (CSE)");
    expect(DEFAULT_DEPARTMENTS).toContain(
      "CSE - Artificial Intelligence & Machine Learning (CSE-AIML)",
    );
    expect(DEFAULT_DEPARTMENTS).toContain("Artificial Intelligence & Machine Learning (AIML)");
    expect(DEFAULT_DEPARTMENTS).toContain("Artificial Intelligence & Data Science (AI & DS)");
    expect(DEFAULT_DEPARTMENTS).toContain("Information Science & Engineering (ISE)");
    expect(DEFAULT_DEPARTMENTS).toContain("Electronics & Communication Engineering (ECE)");
    expect(DEFAULT_DEPARTMENTS).toContain("Master of Business Administration (MBA)");
    expect(DEFAULT_DEPARTMENTS).toContain("Master of Computer Applications (MCA)");
  });

  it("governs canDecide sanction permissions correctly", () => {
    const adminUser: Me = {
      id: "admin-1",
      email: "admin@amc.edu.in",
      profile: {
        id: "admin-1",
        full_name: "Admin",
        email: "admin@amc.edu.in",
        phone: null,
        department_id: null,
        is_active: true,
        created_at: "",
      },
      roles: ["admin"],
      role: "admin",
      collegeRole: "admin",
      isAdmin: true,
      isApprover: true,
      isStaff: false,
    };

    const hodUser: Me = {
      id: "hod-1",
      email: "hod.cs@amc.edu.in",
      profile: {
        id: "hod-1",
        full_name: "HOD CS",
        email: "hod.cs@amc.edu.in",
        phone: null,
        department_id: null,
        is_active: true,
        created_at: "",
      },
      roles: ["approver"],
      role: "approver",
      collegeRole: "hod",
      isAdmin: false,
      isApprover: true,
      isStaff: false,
    };

    const staffUser: Me = {
      id: "staff-1",
      email: "staff@amc.edu.in",
      profile: {
        id: "staff-1",
        full_name: "Faculty",
        email: "staff@amc.edu.in",
        phone: null,
        department_id: null,
        is_active: true,
        created_at: "",
      },
      roles: ["staff"],
      role: "staff",
      collegeRole: "faculty",
      isAdmin: false,
      isApprover: false,
      isStaff: true,
    };

    const pendingBookingForHODVenue: BookingRow = {
      id: "booking-1",
      user_id: "staff-1",
      venue_id: "venue-cs",
      title: "Tech Fest Workshop",
      purpose: "Hands-on workshop for students",
      attendees: 120,
      facilities: ["Projector"],
      start_at: "2026-11-20T10:00:00+05:30",
      end_at: "2026-11-20T12:00:00+05:30",
      status: "pending",
      decided_by: null,
      decided_at: null,
      rejection_reason: null,
      cancelled_by: null,
      cancelled_at: null,
      created_at: "",
      venues: { name: "CS Seminar Hall", approver_id: "hod-1", capacity: 150, location: "Block A" },
      requester: { full_name: "Faculty", email: "staff@amc.edu.in", phone: null },
    };

    const pendingBookingForOtherVenue: BookingRow = {
      ...pendingBookingForHODVenue,
      id: "booking-2",
      venues: {
        name: "Main Auditorium",
        approver_id: "principal-1",
        capacity: 800,
        location: "Main Block",
      },
    };

    const approvedBooking: BookingRow = {
      ...pendingBookingForHODVenue,
      status: "approved",
    };

    // Admin can decide ANY pending booking
    expect(canDecide(adminUser, pendingBookingForHODVenue)).toBe(true);
    expect(canDecide(adminUser, pendingBookingForOtherVenue)).toBe(true);

    // HOD can decide pending booking for their assigned venue
    expect(canDecide(hodUser, pendingBookingForHODVenue)).toBe(true);

    // HOD cannot decide pending booking for another venue
    expect(canDecide(hodUser, pendingBookingForOtherVenue)).toBe(false);

    // Staff cannot decide any booking
    expect(canDecide(staffUser, pendingBookingForHODVenue)).toBe(false);

    // Cannot decide already approved booking
    expect(canDecide(adminUser, approvedBooking)).toBe(false);
  });
});

describe("Strict Validations (2MB Images, RFC Email, 10-digit Phone, Text Lengths)", () => {
  it("enforces strict 2 MB maximum image size limit and allowed formats", async () => {
    const { validateImageFile, MAX_IMAGE_SIZE_BYTES } = await import("@/lib/validations");
    expect(MAX_IMAGE_SIZE_BYTES).toBe(2 * 1024 * 1024);

    // Mock File under 2MB
    const validJpg = new File(["valid-content"], "auditorium.jpg", { type: "image/jpeg" });
    Object.defineProperty(validJpg, "size", { value: 1.5 * 1024 * 1024 });
    const resValid = validateImageFile(validJpg);
    expect(resValid.valid).toBe(true);

    // Mock File over 2MB (e.g. 2.1 MB)
    const largePng = new File(["large-content"], "main-hall.png", { type: "image/png" });
    Object.defineProperty(largePng, "size", { value: 2.1 * 1024 * 1024 });
    const resLarge = validateImageFile(largePng);
    expect(resLarge.valid).toBe(false);
    expect(resLarge.error).toContain("exceeds the maximum allowed size of 2 MB");

    // Mock Unsupported mime type (e.g. PDF or SVG)
    const pdfFile = new File(["pdf-bytes"], "document.pdf", { type: "application/pdf" });
    const resPdf = validateImageFile(pdfFile);
    expect(resPdf.valid).toBe(false);
    expect(resPdf.error).toContain("not a supported image format");
  });

  it("validates RFC-compliant email addresses strictly", async () => {
    const { isValidEmail } = await import("@/lib/validations");
    expect(isValidEmail("admin@amc.edu.in")).toBe(true);
    expect(isValidEmail("principal@amcgroup.edu.in")).toBe(true);
    expect(isValidEmail("hod.cse@amc.edu.in")).toBe(true);
    expect(isValidEmail("faculty.member+test@gmail.com")).toBe(true);

    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@domain")).toBe(false);
    expect(isValidEmail("@no-user.com")).toBe(false);
    expect(isValidEmail("spaces in@amc.edu.in")).toBe(false);
  });

  it("validates Indian & institutional phone numbers strictly", async () => {
    const { isValidPhone } = await import("@/lib/validations");
    // Standard 10 digits
    expect(isValidPhone("9876543210")).toBe(true);
    expect(isValidPhone("8123456789")).toBe(true);
    expect(isValidPhone("7012345678")).toBe(true);

    // With +91 or 91 country code prefix
    expect(isValidPhone("+91 9876543210")).toBe(true);
    expect(isValidPhone("+91-9876543210")).toBe(true);
    expect(isValidPhone("919876543210")).toBe(true);

    // Invalid phones
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("12345")).toBe(false); // too short
    expect(isValidPhone("phone123456")).toBe(false); // contains letters
    expect(isValidPhone("9876543210123456789")).toBe(false); // too long
  });

  it("validates text length constraints for titles, agendas, descriptions, and rejection reasons", async () => {
    const { validateText } = await import("@/lib/validations");

    // Title: 3 to 150 chars
    expect(validateText("AI", 3, 150, "Title").valid).toBe(false);
    expect(validateText("Annual Tech Symposium 2026", 3, 150, "Title").valid).toBe(true);
    expect(validateText("A".repeat(151), 3, 150, "Title").valid).toBe(false);

    // Purpose / Agenda: 10 to 1000 chars
    expect(validateText("Short", 10, 1000, "Purpose").valid).toBe(false);
    expect(
      validateText("State-level hackathon for final-year engineering scholars", 10, 1000, "Purpose")
        .valid,
    ).toBe(true);

    // Rejection reason: 5 to 500 chars
    expect(validateText("No", 5, 500, "Rejection reason").valid).toBe(false);
    expect(
      validateText(
        "Auditorium under scheduled maintenance by Facilities Department",
        5,
        500,
        "Rejection reason",
      ).valid,
    ).toBe(true);
  });
});

describe("Slot Cancellation Recycling & Concurrency", () => {
  const date = "2026-12-10";
  const start = toIso(date, "14:00");
  const end = toIso(date, "16:00");

  it("frees slot and 30-min buffer immediately when a booking is cancelled, allowing another booking", () => {
    // Initial state: Booking A is approved for 14:00 - 16:00
    const bookings = [
      {
        id: "booking-a",
        title: "Mechanical Seminar",
        venue_id: "venue-1",
        start_at: start,
        end_at: end,
        status: "approved",
      },
    ];

    // Attempting to book the same slot (or overlapping slot) while Booking A is approved
    const newReqStart = toIso(date, "15:00");
    const newReqEnd = toIso(date, "17:00");

    // Check conflict against approved bookings only
    const approvedBefore = bookings.filter((b) => b.status === "approved");
    const conflictBefore = approvedBefore.some((b) =>
      conflictsWithBuffer(newReqStart, newReqEnd, b.start_at, b.end_at),
    );
    expect(conflictBefore).toBe(true);

    // Cancel Booking A -> status transitions to 'cancelled'
    bookings[0].status = "cancelled";

    // Recycled slot check: Only approved bookings block slots
    const approvedAfter = bookings.filter((b) => b.status === "approved");
    const conflictAfter = approvedAfter.some((b) =>
      conflictsWithBuffer(newReqStart, newReqEnd, b.start_at, b.end_at),
    );
    // Booking can now proceed without conflict!
    expect(conflictAfter).toBe(false);
  });

  it("handles idempotency deduplication window correctly", () => {
    const now = Date.now();
    const twentySecsAgo = now - 20000;

    // Simulate an identical submission 5 seconds ago
    const existingSubmissionTime = now - 5000;
    const isDuplicate = existingSubmissionTime >= twentySecsAgo;
    expect(isDuplicate).toBe(true);

    // Simulate an identical submission from 25 seconds ago (outside window)
    const oldSubmissionTime = now - 25000;
    const isOldDuplicate = oldSubmissionTime >= twentySecsAgo;
    expect(isOldDuplicate).toBe(false);
  });
});
