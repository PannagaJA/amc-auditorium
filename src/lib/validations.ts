export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB strict limit
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

/** Validate that uploaded file is an image under 2MB */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File "${file.name}" is not a supported image format. Allowed formats: JPEG, PNG, WebP.`,
    };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image "${file.name}" exceeds the maximum allowed size of 2 MB (Current: ${sizeMb} MB). Please compress or choose a smaller image.`,
    };
  }
  return { valid: true };
}

/** Validate institutional or standard email format */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  // Standard RFC-compliant regex
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(trimmed) && trimmed.length <= 255;
}

/**
 * Validate phone numbers: accepts standard 10-digit mobile numbers,
 * optional country code prefix (+91 or 91), standard landlines, or E.164.
 * Rejects letters, symbols, or invalid digit counts.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  // Indian mobile 10 digits, or with +91/91 prefix, or international E.164 (10 to 15 digits)
  const re = /^(\+91|91)?[6-9]\d{9}$|^(\+)?[1-9]\d{9,14}$/;
  return re.test(cleaned);
}

/** Validate word / text character lengths */
export function validateText(
  val: string | null | undefined,
  min: number,
  max: number,
  fieldName: string,
): { valid: boolean; error?: string } {
  const str = (val ?? "").trim();
  if (str.length < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${min} characters long (currently ${str.length}).`,
    };
  }
  if (str.length > max) {
    return {
      valid: false,
      error: `${fieldName} cannot exceed ${max} characters (currently ${str.length}).`,
    };
  }
  return { valid: true };
}
