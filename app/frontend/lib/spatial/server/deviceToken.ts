import { timingSafeEqual } from "node:crypto";

export function deviceTokenOk(given: string | null): boolean {
  const expected = process.env.DEVICE_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
