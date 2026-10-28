import type { CriterionRow } from "../../domain/searchCriteria.types";

/** Místo, kde se dá hledat — složka, odkud hledání začalo, domov, disky. */
export type SearchLocation = { path: string; label: string };

export type SearchCriteriaBarProps = {
  root: string;
  /** Text z toolbaru — bez kritérií z něj vznikne řádek „Název obsahuje". */
  query: string;
  criteria: CriterionRow[];
  locations: SearchLocation[];
  /** Tlačítko Hledat (nebo Enter v poli) — kritéria a místo platí až teď. */
  onApply: (root: string, criteria: CriterionRow[]) => void;
};
