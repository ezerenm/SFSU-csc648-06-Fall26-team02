import { timingSafeEqual } from "crypto";

/**
 * Constant-time check of a shared secret from a request header.
 * Until accounts exist (R1), the operator API is protected by OPERATOR_TOKEN,
 * kept separate from the phone's DEVICE_TOKEN because that one ships inside the app.
 * @returns false when either value is missing or they differ
 */
export function tokenMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
