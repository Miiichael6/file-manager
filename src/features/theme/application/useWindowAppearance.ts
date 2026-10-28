import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

import * as storage from "../../../shared/infrastructure/storage";
import { applyMotion, motionEnabled } from "../../../shared/lib/motion";
import type { Theme } from "../../../shared/domain/types";
import { applyTheme, resolveTheme, systemTheme, watchSystemTheme } from "./theme";
import type { ThemePreference } from "./theme.types";
import {
  applyWindowBackdrop,
  acrylicSupported,
  systemTransparency,
  watchSystemTransparency,
  windowBackdrop,
} from "./glass";
import { windowChrome } from "./ports";
import type { Options } from "./useWindowAppearance.types";

/**
 * Vzhled okna: téma (vč. sledování režimu Windows), průhlednost / Acrylic,
 * aktivita okna a ukázání okna po prvním renderu.
 */
export function useWindowAppearance({ themePreference, windowTransparency, transparencyStrength }: Options) {
  // Režim Windows se sleduje za běhu — při volbě „Podle systému" se okno
  // přebarví hned, jak ho uživatel přepne v Nastavení.
  const [osTheme, setOsTheme] = useState<Theme>(systemTheme);
  useEffect(() => watchSystemTheme(() => setOsTheme(systemTheme())), []);
  const theme: Theme = themePreference === "system" ? osTheme : themePreference;

  useEffect(() => applyTheme(theme), [theme]);

  /**
   * Volba vzhledu (menu Více → Vzhled, paleta). Celé okno se prolne naráz
   * přes View Transition: snímek starého vzhledu zhasne nad novým, takže
   * žádná plocha nedobíhá svým tempem. Nový stav musí být v DOM hotový
   * uvnitř callbacku — proto flushSync (zápis do storage je synchronní,
   * na disk se dopisuje až potom).
   */
  const changeTheme = useCallback(
    (preference: ThemePreference) => {
      if (preference === themePreference) return;
      const next = resolveTheme(preference);
      const root = document.documentElement;
      const apply = () => {
        flushSync(() => void storage.setTheme(preference));
        applyTheme(next);
      };
      if (next === theme) {
        // Jen jiná volba se stejným výsledkem (tmavý → podle systému v noci).
        apply();
        return;
      }
      const done = () => root.classList.remove("is-theming");

      root.classList.add("is-theming");
      const withTransition = document as Document & {
        startViewTransition?: (update: () => void) => { finished: Promise<void> };
      };
      if (withTransition.startViewTransition && motionEnabled()) {
        withTransition.startViewTransition(apply).finished.finally(done);
      } else {
        apply();
        // Až po vykreslení nového stavu, ať se nic nerozjede dodatečně.
        requestAnimationFrame(() => requestAnimationFrame(done));
      }
    },
    [theme, themePreference],
  );

  /** Světlý <-> tmavý (paleta) — nastaví vzhled napevno. */
  const toggleTheme = useCallback(() => changeTheme(theme === "dark" ? "light" : "dark"), [changeTheme, theme]);

  // Okno startuje skryté (tauri.conf.json). Ukáže se, až je hotový první
  // render, nastavení (téma je už z localStorage, main.tsx) a písmo — bez
  // bílého záblesku a bez přeskočení fontu. Když JS spadne, ukáže ho Rust
  // sám po 1,5 s.
  const [ready, setReady] = useState(false);
  // Smí zapnutá Průhlednost rozmazávat (Efekty průhlednosti, Windows 11 22H2+)?
  const [blurAllowed, setBlurAllowed] = useState(true);
  // Umí Windows Acrylic vůbec? Jinak menu ani paleta rozmazanou nenabízí.
  const [acrylicAvailable, setAcrylicAvailable] = useState(false);
  // Windows bez Acrylicu (10, 11 před 22H2): průhlednost se nenabízí vůbec
  // a uložená zapnutá se vypne (ostrá průhlednost od 1.6 není).
  useEffect(() => {
    void Promise.all([acrylicSupported(), storage.init()]).then(([supported]) => {
      setAcrylicAvailable(supported);
      if (!supported && storage.getSnapshot().windowTransparency) void storage.setWindowTransparency(false);
    });
  }, []);
  // Neaktivní okno: Windows Acrylic nahradí plnou výplní — CSS okno předtím
  // zneprůhlední (index.css, data-inactive), ať nepřeskočí na cizí šedou.
  // Aktivace z Rustu (WM_NCACTIVATE, snap.rs) — window.blur přijde i při
  // fokusu do iframe náhledu a onFocusChanged Tauri při aktivaci bez fokusu
  // ve webview vůbec.
  useEffect(() => {
    const root = document.documentElement;
    const chrome = windowChrome.get();
    const unlisten = chrome.onActiveChange((active) => root.toggleAttribute("data-inactive", !active));
    // Výchozí stav (start, reload stránky) — událost chodí jen při změně.
    void unlisten.then(() =>
      chrome
        .isActive()
        .then((active) => root.toggleAttribute("data-inactive", !active))
        .catch(() => undefined),
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([storage.init(), document.fonts?.ready, systemTransparency()])
      // Průhlednost platí už pro první snímek okna — podklad i CSS před ukázáním.
      .then(([, , blur]) => {
        if (active) setBlurAllowed(blur);
        const { windowTransparency: on, transparencyStrength: strength } = storage.getSnapshot();
        return applyWindowBackdrop(windowBackdrop(on, blur), strength);
      })
      .catch(() => undefined)
      // Volba animací musí platit už pro rozsvícení okna.
      .then(() => applyMotion(storage.getSnapshot().motion))
      .then(() => windowChrome.get().ready())
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Průhlednost za běhu: menu, paleta, změna Efektů průhlednosti ve Windows
  // (chytí ji návrat do okna). Hlídá se jen se zapnutou volbou.
  useEffect(() => {
    if (!ready) return;
    void applyWindowBackdrop(
      windowBackdrop(windowTransparency, blurAllowed),
      transparencyStrength,
    );
  }, [ready, windowTransparency, blurAllowed, transparencyStrength]);
  useEffect(() => {
    if (!ready || !windowTransparency) return;
    let alive = true;
    const check = () =>
      void systemTransparency().then((blur) => {
        if (alive) setBlurAllowed(blur);
      });
    const stop = watchSystemTransparency(check);
    // Efekty průhlednosti se mohly změnit, zatímco byla volba vypnutá — okno
    // je už zaostřené, focus nepřijde.
    check();
    return () => {
      alive = false;
      stop();
    };
  }, [ready, windowTransparency]);

  return { theme, changeTheme, toggleTheme, ready, acrylicAvailable, blurAllowed };
}
