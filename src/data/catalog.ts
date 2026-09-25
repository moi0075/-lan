import data from "./countries.json";
export interface Country {
  id: string;
  mapId: string;
  alpha2: string;
  name: string;
  capital: string;
  population: number;
  continent: string;
  coordinates: number[];
  point: number[];
  small: boolean;
}
export const countries: Country[] = data;
export const countryById = new Map(countries.map((c) => [c.id, c]));
export const countryByMapId = new Map(countries.map((c) => [c.mapId, c]));
export function flag(c: Country): string {
  return c.alpha2
    .toUpperCase()
    .replace(/./g, (l) => String.fromCodePoint(127397 + l.charCodeAt(0)));
}
export function population(n: number): string {
  return new Intl.NumberFormat("fr", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
