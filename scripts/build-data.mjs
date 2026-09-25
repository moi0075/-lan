/** Build a reproducible, offline geography snapshot. Optional arg: local REST Countries JSON. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { presimplify, quantile, simplify } from "topojson-simplify";
const url =
  "https://raw.githubusercontent.com/restcountries/restcountries/master/src/main/resources/countriesV3.1.json";
const raw = process.argv[2]
  ? await readFile(process.argv[2], "utf8")
  : await (await fetch(url)).text();
const all = JSON.parse(raw);
// Upstream incorrectly marks Guinea-Bissau as a nonmember; UN member since 1974.
const included = all.filter(
  (c) =>
    c.unMember || ["GNB", "VAT", "PSE", "TWN", "UNK", "XKX"].includes(c.cca3),
);
const regions = {
  Africa: "Afrique",
  Europe: "Europe",
  Asia: "Asie",
  "North America": "Amérique du Nord",
  "South America": "Amérique du Sud",
  Oceania: "Océanie",
};
const capitals = {
  "New Delhi": "New Delhi",
  Beijing: "Pékin",
  "Washington, D.C.": "Washington",
  Tokyo: "Tokyo",
  Moscow: "Moscou",
  Cairo: "Le Caire",
  Dhaka: "Dacca",
  London: "Londres",
  Rome: "Rome",
  Athens: "Athènes",
  Lisbon: "Lisbonne",
  Vienna: "Vienne",
  Warsaw: "Varsovie",
  Brussels: "Bruxelles",
  Prague: "Prague",
  Copenhagen: "Copenhague",
  Damascus: "Damas",
  Algiers: "Alger",
  "Mexico City": "Mexico",
  "Vatican City": "Cité du Vatican",
};
const fixes = {
  VAT: [41.9029, 12.4534],
  MCO: [43.7384, 7.4246],
  SGP: [1.3521, 103.8198],
  NRU: [-0.5228, 166.9315],
  TUV: [-8.5167, 179.2167],
  KIR: [1.4167, 173],
  MHL: [7.1167, 171.1833],
  MDV: [4.1755, 73.5093],
  PLW: [7.5, 134.5],
  FSM: [6.9167, 158.25],
};
const countries = included
  .map((c) => ({
    id: c.cca3 === "UNK" ? "XKX" : c.cca3,
    mapId: c.ccn3 || "kosovo",
    alpha2: c.cca2,
    name: c.translations.fra.common,
    capital:
      (c.capital || []).map((s) => capitals[s] || s).join(" · ") ||
      "Non désignée",
    population: c.population,
    continent: regions[c.continents?.[0]] || regions[c.region],
    coordinates: fixes[c.cca3] || c.latlng,
  }))
  .sort((a, b) => b.population - a.population);
if (
  countries.length !== 197 ||
  new Set(countries.map((c) => c.id)).size !== 197
)
  throw Error("Expected 197 unique countries");
const topology = JSON.parse(
  await readFile("node_modules/world-atlas/countries-50m.json", "utf8"),
);
const weighted = presimplify(topology);
// Preserve shared borders, retaining the most significant 20% of vertices.
const simplified = simplify(weighted, quantile(weighted, 0.2));
const features = feature(simplified, simplified.objects.countries).features;
const projection = geoNaturalEarth1().scale(172).translate([500, 286]);
const path = geoPath(projection).digits(1);
const map = features
  .filter((f) => f.id !== "010")
  .map((f) => ({
    id:
      f.properties.name === "Kosovo" ? "kosovo" : String(f.id).padStart(3, "0"),
    name: f.properties.name,
    d: path(f),
    area: path.area(f),
  }));
const result = countries.map((c) => {
  const shape = map.find((s) => s.id === c.mapId);
  return {
    ...c,
    point: projection([c.coordinates[1], c.coordinates[0]]),
    small: !shape || shape.area < 18,
  };
});
await writeFile("src/data/countries.json", JSON.stringify(result));
await writeFile("src/data/map.json", JSON.stringify(map));
await writeFile(
  "src/data/source.json",
  JSON.stringify(
    {
      retrievedAt: new Date().toISOString().slice(0, 10),
      countriesSource: url,
      sha256: createHash("sha256").update(raw).digest("hex"),
      mapSource: "https://github.com/topojson/world-atlas",
      mapVersion: "2.0.2",
      simplification: 0.2,
      scope:
        "193 membres de l’ONU + Vatican, Palestine, Kosovo et Taïwan. Les territoires dépendants ne font pas partie du parcours. Frontières de facto Natural Earth ; représentation sans prise de position politique.",
      populationNote:
        "Instantané REST Countries : années de référence variables selon les pays. Le classement suit les populations de ce jeu de données, et non un compteur en temps réel.",
    },
    null,
    2,
  ),
);
console.log(
  `${countries.length} countries; ${map.length} map shapes; ${result.filter((c) => c.small).length} small-country markers. First: ${countries
    .slice(0, 5)
    .map((c) => c.name)
    .join(", ")}.`,
);
