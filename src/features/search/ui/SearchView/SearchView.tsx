import { useEffect, useRef, useState } from "react";

import { SearchX } from "lucide-react";

import { ResultsView } from "../ResultsView";
import { cancelSearch, searchRecursive } from "../../../../shared/application/fileops";
import { failure, useT } from "../../../../shared/i18n/index";
import { compileCriteria } from "../../domain/searchCriteria";
import type { FileEntry } from "../../../../shared/domain/types";
import type { SearchViewProps } from "./SearchView.types";

/** Identita hledání pro backend — napříč všemi SearchView, proto modulová. */
let nextSearchId = 1;

/** Strop pro jedno hledání. Víc řádků stejně nikdo neprojde a průchod by rostl. */
export const MAX_RESULTS = 500;

/** Rekurzivní hledání od `root`. Vykresluje ResultsView. */
export function SearchView({
  root,
  query,
  criteria,
  windowFocused,
  selectedPath,
  onSelectionChange,
  onOpen,
  onContextMenu,
  refreshToken,
  showHidden,
  onCountChange,
}: SearchViewProps) {
  const t = useT();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const lastSearch = useRef<string | null>(null);

  // Průchod velkého stromu trvá; bez tohohle by pomalejší odpověď na starší
  // dotaz přepsala výsledky toho, co uživatel mezitím napsal.
  useEffect(() => {
    const id = ++requestId.current;
    const searchId = nextSearchId++;
    setError(null);

    // Nový dotaz začíná načítací obrazovkou. Přenačtení po operaci (smazání,
    // přejmenování) nechá staré výsledky viset, dokud nedorazí nové.
    const rules = criteria === undefined ? null : compileCriteria(criteria);
    const key = `${root}\0${query}\0${JSON.stringify(rules)}`;
    if (lastSearch.current !== key) {
      lastSearch.current = key;
      setEntries([]);
      setLoading(true);
    }

    // Lišta bez jediného platného kritéria — není co hledat.
    if (rules !== null && rules.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    searchRecursive(root, query, MAX_RESULTS, showHidden, searchId, rules)
      .then((found) => {
        if (requestId.current !== id) return;

        setEntries(found);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return;

        setEntries([]);
        setError(failure("op.search", err));
        setLoading(false);
      });

    // Nový dotaz, zavření výsledků (Escape, vymazání pole) i odchod jinam
    // zastaví průchod disku — jinak by na C:\ běžel dál naprázdno.
    return () => void cancelSearch(searchId).catch(() => undefined);
  }, [root, query, criteria, refreshToken, showHidden]);

  return (
    <ResultsView
      entries={entries}
      loading={loading}
      loadingMessage={t("search.searching")}
      error={error}
      empty={{
        Icon: SearchX,
        title:
          criteria === undefined
            ? t("empty.noMatches", { query })
            : compileCriteria(criteria).length === 0
              ? t("criteria.empty")
              : t("criteria.noMatches"),
        hint: criteria === undefined ? t("search.hint") : t("criteria.hint"),
      }}
      root={root}
      footer={
        entries.length === MAX_RESULTS && (
          <div className="px-3 py-2 text-[11px] text-secondary">
            {t("search.limited", { count: MAX_RESULTS })}
          </div>
        )
      }
      windowFocused={windowFocused}
      selectedPath={selectedPath}
      onSelectionChange={onSelectionChange}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      onCountChange={onCountChange}
    />
  );
}
