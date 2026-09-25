import { describe, expect, it } from "vitest";
import { countries } from "../data/catalog";
import { evaluateCountryName } from "./nameAnswer";

describe("country name grading", () => {
  it("recognises every one of the 197 catalogue names", () => {
    for (const country of countries)
      expect(evaluateCountryName(country.name, country.id), country.name).toBe(
        "exact",
      );
  });
  it.each([
    ["  FRANCE  ", "FRA"],
    ["les Etats Unis", "USA"],
    ["cote d ivoire", "CIV"],
    ["l’Inde", "IND"],
    ["RDC", "COD"],
    ["République démocratique du Congo", "COD"],
    ["Congo Brazzaville", "COG"],
    ["Vietnam", "VNM"],
    ["Eswatini", "SWZ"],
    ["Palau", "PLW"],
    ["Cap Vert", "CPV"],
    ["Vatican", "VAT"],
  ])("ignores typography and recognises established names: %s", (input, id) => {
    expect(evaluateCountryName(input, id)).toBe("exact");
  });
  it.each([
    ["fraance", "FRA"],
    ["francece", "FRA"],
    ["frnace", "FRA"],
    ["franc", "FRA"],
    ["irna", "IRN"],
  ])("treats %s as a close error, never as a success", (input, id) => {
    expect(evaluateCountryName(input, id)).toBe("close");
  });
  it.each([
    ["Iran", "IRQ"],
    ["Irak", "IRN"],
    ["Niger", "NGA"],
    ["Nigeria", "NER"],
    ["Autriche", "AUS"],
    ["Congo", "COD"],
    ["Corée du Nord", "KOR"],
    ["Slovénie", "SVK"],
    ["", "FRA"],
    ["   ", "FRA"],
    ["france123", "FRA"],
    ["fr", "FRA"],
    ["n’importe quoi", "FRA"],
    ["chile", "CHN"],
    ["chile", "CHL"],
  ])(
    "keeps another country, ambiguity or unrelated text incorrect: %s / %s",
    (input, id) => {
      expect(evaluateCountryName(input, id)).toBe("incorrect");
    },
  );
});
