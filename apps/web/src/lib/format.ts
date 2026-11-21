const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export const formatNaira = (n: number) => naira.format(Math.round(n));

/** ₦12.4m / ₦850k style for headlines. */
export function formatNairaShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `₦${(n / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}m`;
  if (abs >= 1e3) return `₦${Math.round(n / 1e3)}k`;
  return `₦${Math.round(n)}`;
}

export function formatQty(n: number, unit: string): string {
  const digits = ["nr", "bag", "piece"].includes(unit) ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toLocaleString("en-NG", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${unit}`;
}

export const formatMm = (mm: number) => (mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`);
