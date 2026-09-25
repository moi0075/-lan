import { countries } from "../data/catalog";

export type NameMatch = "exact" | "close" | "incorrect";

/** Common French names and unambiguous abbreviations, in addition to the catalogue. */
const aliases: Record<string, string[]> = {
  USA: ["USA", "États-Unis d'Amérique"],
  GBR: ["UK", "Grande-Bretagne"],
  COD: [
    "RDC",
    "RD Congo",
    "République démocratique du Congo",
    "Congo Kinshasa",
  ],
  COG: ["République du Congo", "Congo Brazzaville"],
  CZE: ["République tchèque"],
  MMR: ["Myanmar"],
  SWZ: ["Eswatini"],
  VNM: ["Vietnam"],
  CIV: ["Côte d’Ivoire"],
  ARE: ["Émirats arabes unis", "EAU"],
  CPV: ["Cap-Vert", "Cabo Verde"],
  VAT: ["Vatican"],
  MUS: ["Maurice"],
  PLW: ["Palaos", "Palau"],
  TLS: ["Timor-Leste"],
  FSM: ["États fédérés de Micronésie"],
  STP: ["Sao Tomé et Principe"],
  BHS: ["Bahamas"],
  SLB: ["Salomon"],
  MHL: ["Marshall"],
  KNA: ["Saint-Kitts-et-Nevis", "Saint-Christophe-et-Nevis"],
  PRK: ["République populaire démocratique de Corée"],
  KOR: ["République de Corée"],
};

/** Typography is not a geography mistake. Keep digits so they cannot disappear. */
export function normalizeCountryName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/^(?:(?:le|la|les)\s+|l['’]\s*)/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Edit distance with adjacent-letter swaps counted as one typing mistake. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

const names = countries.map((c) => ({
  id: c.id,
  values: [
    ...new Set([c.name, ...(aliases[c.id] || [])].map(normalizeCountryName)),
  ],
}));

/** Distinguish a close spelling error from a confusion with another country. */
export function evaluateCountryName(
  input: string,
  targetId: string,
): NameMatch {
  const text = normalizeCountryName(input);
  if (!text || input.length > 100 || /\d/.test(text)) return "incorrect";
  const exact = names.filter((c) => c.values.includes(text));
  if (exact.length)
    return exact.length === 1 && exact[0].id === targetId
      ? "exact"
      : "incorrect";
  const candidates = names.flatMap((c) => {
    const distances = c.values.flatMap((name) => {
      const length = Math.min(name.length, text.length);
      const limit = length >= 5 ? 2 : length >= 4 ? 1 : 0;
      if (Math.abs(name.length - text.length) > limit) return [];
      const distance = editDistance(text, name);
      return distance <= limit ? [distance] : [];
    });
    return distances.length
      ? [{ id: c.id, distance: Math.min(...distances) }]
      : [];
  });
  const closest = Math.min(...candidates.map((c) => c.distance));
  const winners = candidates.filter((c) => c.distance === closest);
  return winners.length === 1 && winners[0].id === targetId
    ? "close"
    : "incorrect";
}
