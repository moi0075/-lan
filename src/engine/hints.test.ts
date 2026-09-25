import { describe, it, expect } from "vitest";
import { countries } from "../data/catalog";
import { candidateCountries } from "./hints";
describe("opt-in five-country hint", () => {
  it("includes exactly five unique valid choices and the answer for all 197 countries", () => {
    for (const country of countries) {
      const ids = candidateCountries(countries, country.id, 17);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      expect(ids).toContain(country.id);
      expect(ids.every((id) => countries.some((c) => c.id === id))).toBe(true);
    }
  });
  it("is stable across rerenders and does not encode the answer at one fixed position", () => {
    expect(candidateCountries(countries, "IND", 11)).toEqual(
      candidateCountries(countries, "IND", 11),
    );
    const positions = new Set(
      countries.map((c) =>
        candidateCountries(countries, c.id, 1).indexOf(c.id),
      ),
    );
    expect(positions.size).toBe(5);
  });
});
