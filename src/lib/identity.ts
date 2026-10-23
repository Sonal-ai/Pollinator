/** Ten-digit national numbers use the application's Indian locale. */
export function normalizePhone(value: string): string | null {
  const input = value.trim();
  if (!/^\+?[\d\s()-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (input.startsWith('+')) return /^[1-9]\d{7,14}$/.test(digits) ? '+' + digits : null;
  if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return '+' + digits;
  // Meta supplies the international sender ID without a leading '+'.
  return /^[1-9]\d{10,14}$/.test(digits) ? '+' + digits : null;
}
export function normalizeLoginIdentifier(value: string): string | null {
  const input = value.trim();
  if (input.length > 254) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return input.toLowerCase();
  return normalizePhone(input);
}
/** Exact legacy variants only; never suffix-match another country's number. */
export function phoneLookupVariants(value: string): string[] {
  const canonical = normalizePhone(value);
  if (!canonical) return [];
  const variants = [canonical, canonical.slice(1)];
  if (/^\+91[6-9]\d{9}$/.test(canonical)) variants.push(canonical.slice(3));
  return variants;
}
