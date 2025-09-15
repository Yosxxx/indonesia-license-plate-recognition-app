// lib/plate.ts
export type PlateRow = {
  plateNumber: string; // e.g. "B 1970 SSW"
  plateOrigin: string; // e.g. "Jakarta"
  expiryDate: string; // e.g. "05-21" (MM-YY)
  remaining: number; // days left (can be negative if expired)
  timestamp: string; // e.g. "15-09-2025 | 15:23:10"
};

// Common Indonesian prefixes (expand as you like).
// If unknown, we'll label "Unknown".
const ORIGIN_MAP: Record<string, string> = {
  A: "Banten",
  B: "Jakarta (Greater Jakarta)",
  D: "Greater Bandung",
  E: "Cirebon",
  F: "Bogor / Sukabumi / Cianjur",
  G: "Pekalongan",
  H: "Semarang",
  K: "Rembang / Pati / Kudus (ex-Karesidenan Pati)",
  L: "Surabaya",
  M: "Madura",
  N: "Malang / Pasuruan",
  P: "Besuki / Jember / Bondowoso / Situbondo / Banyuwangi",
  R: "Banyumas",
  AA: "Kedu",
  AB: "Yogyakarta",
  AD: "Surakarta / Klaten / Sragen / Boyolali",
  AE: "Madiun / Magetan / Ponorogo / Pacitan / Ngawi",
  AG: "Kediri / Blitar / Trenggalek / Nganjuk",
  BA: "West Sumatra",
  BB: "Tapanuli",
  BD: "Bengkulu",
  BE: "Lampung",
  BG: "Palembang (South Sumatra)",
  BH: "Jambi",
  BK: "Medan (North Sumatra / East Sumatra)",
  BL: "Aceh",
  BM: "Riau (mainland)",
  BN: "Riau Islands",
  BP: "Riau Islands (Batam/Tg. Pinang)",
  BR: "West Kalimantan",
  DA: "South Kalimantan",
  DB: "Manado",
  DD: "Sulawesi (SE/North Gorontalo legacy)",
  DE: "Ambon (Maluku)",
  DG: "Ternate (North Maluku)",
  DH: "Timor (NTT)",
  DK: "Bali",
};

export function getPlatePrefix(plateSpacedOrCanon: string): string {
  // Normalize: keep letters/digits/spaces
  const cleaned = plateSpacedOrCanon.replace(/[^A-Za-z0-9 ]/g, "").trim();
  if (!cleaned) return "";
  // Usually "B 1234 ABC" → first token is "B"
  const firstToken = cleaned.split(/\s+/)[0].toUpperCase();
  // Try two-letter prefixes first (AA, AB, AD, AE, AG, etc.)
  const two = firstToken.slice(0, 2);
  if (ORIGIN_MAP[two]) return two;
  // Fallback to a single letter
  return firstToken.slice(0, 1);
}

export function getOriginFromPlate(plateSpacedOrCanon: string): string {
  const prefix = getPlatePrefix(plateSpacedOrCanon);
  return ORIGIN_MAP[prefix] ?? "Unknown";
}

export function daysRemainingFromExpiry(human: string | undefined): number {
  // human like "05-21" (MM-YY). If not present, return NaN so you can handle.
  if (!human) return NaN;
  const m = /^(\d{1,2})[-/](\d{2})$/.exec(human);
  if (!m) return NaN;
  const mm = Math.max(1, Math.min(12, parseInt(m[1], 10)));
  const yy = parseInt(m[2], 10);
  // Assume 20YY
  const fullYear = 2000 + yy;

  // Expiry at end of month
  const endOfMonth = new Date(fullYear, mm, 0); // day 0 of next month = last day of mm
  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endOfMonth.getTime() - startOfDay(today).getTime()) / msPerDay);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function nowTimestamp(): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date();
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} | ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}
