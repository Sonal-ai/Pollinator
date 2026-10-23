/** Grams by default, as asked in the prompt; an explicit kg unit converts exactly. */
export function parseHarvestQuantity(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x966));
  const match = text.match(/^([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,3})?)\s*(kg|kgs|kilo(?:grams?)?|किलो(?:ग्राम)?|किग्रा|g|gm|gms|grams?|ग्राम|ग्रा)?$/);
  if (!match) return null;
  const [integer] = match[1].split('.');
  if (integer.includes(',') && !/^\d{1,3}(?:,\d{3})+$/.test(integer) && !/^\d{1,2}(?:,\d{2})*,\d{3}$/.test(integer)) return null;
  const unit = match[2] ?? 'g';
  const factor = /^(kg|kilo|किलो|किग्रा)/.test(unit) ? 1000 : 1;
  const value = Number(match[1].replaceAll(',', '')) * factor;
  const grams = Math.round(value);
  return Number.isSafeInteger(grams) && grams > 0 && grams <= 10_000_000 && Math.abs(value - grams) < 0.000001 ? grams : null;
}
