// MI-FORK: kontextové menu souborů jako nativní popup Windows (Tauri `Menu.popup`).
// Na rozdíl od HTML menu smí přesáhnout okno aplikace, jako v Průzkumníku.
// Položky se berou z téhož `MenuItem[]`, jaký kreslí `ContextMenu` — App nic
// dalšího nestaví. Ikony nativní menu neukazuje a Shift+klik (`shiftItems`) nezná.

import { useEffect, useState } from "react";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { CheckMenuItem, Menu, MenuItem as NativeItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";

import type { MenuItem } from "../components/ContextMenu";
import { TAG_COLORS, tagLabel } from "../lib/tags";

type Closable = { close(): Promise<void> };
type NativeEntry = NativeItem | CheckMenuItem | PredefinedMenuItem | Submenu;

/** Položka podmenu (`SubmenuEntry` v ContextMenu.tsx není exportovaný). */
type Entry = MenuItem extends infer T ? (T extends { type: "submenu"; items: (infer E)[] } ? E : never) : never;

/** `&` je ve Win32 menu mnemonika — `&&` = obyčejný znak. */
function text(label: string, shortcut?: string): string {
  const escaped = label.replace(/&/g, "&&");
  // Zkratka jen jako text za tabulátorem (Windows ji zarovná doprava). Jako
  // `accelerator` by ji Tauri parsovalo a zaregistrovalo, a ty řeší App sama.
  return shortcut ? `${escaped}\t${shortcut}` : escaped;
}

async function build(items: readonly (MenuItem | Entry)[], created: Closable[]): Promise<NativeEntry[]> {
  const out: NativeEntry[] = [];
  for (const item of items) {
    let entry: NativeEntry;
    switch (item.type) {
      case "separator":
        // Bez oddělovače na začátku, na konci a dvou za sebou (git.menuItems ho dává na začátek).
        if (out.length === 0 || out[out.length - 1] instanceof PredefinedMenuItem) continue;
        entry = await PredefinedMenuItem.new({ item: "Separator" });
        break;
      case "header":
        entry = await NativeItem.new({ text: text(item.label), enabled: false });
        break;
      case "item":
        entry =
          item.checked === undefined
            ? await NativeItem.new({
                text: text(item.label, item.shortcut),
                enabled: !item.disabled,
                action: () => item.onSelect(),
              })
            : await CheckMenuItem.new({
                text: text(item.label, item.shortcut),
                enabled: !item.disabled,
                checked: item.checked,
                action: () => item.onSelect(),
              });
        break;
      case "tags": {
        const colors = await Promise.all(
          TAG_COLORS.map((color) =>
            CheckMenuItem.new({
              text: text(tagLabel(color)),
              checked: item.active.includes(color),
              action: () => item.onToggle(color),
            }),
          ),
        );
        created.push(...colors);
        entry = await Submenu.new({ text: text(item.label), items: colors });
        break;
      }
      case "submenu": {
        const children = await build(item.items, created);
        entry = await Submenu.new({
          text: text(item.label),
          enabled: !("disabled" in item && item.disabled),
          items: children,
        });
        break;
      }
    }
    created.push(entry);
    out.push(entry);
  }
  while (out[out.length - 1] instanceof PredefinedMenuItem) out.pop();
  return out;
}

/** Ukáže nativní menu na souřadnicích okna (CSS px) a vrátí se po jeho zavření. */
export async function popupNativeMenu(items: MenuItem[], x: number, y: number): Promise<void> {
  const created: Closable[] = [];
  try {
    const menu = await Menu.new({ items: await build(items, created) });
    created.push(menu);
    await menu.popup(new LogicalPosition(x, y));
  } finally {
    // Akce dorazí kanálem až po zavření menu — prostředky v Rustu uvolnit s rezervou.
    window.setTimeout(() => created.forEach((item) => void item.close().catch(() => {})), 1000);
  }
}

/**
 * Napojení pro App: dokud `menu` není null, ukáže ho nativně a pak zavolá
 * `onClose`. Vrací false, když nativní menu selhalo — App pak vykreslí HTML.
 */
export function useNativeMenu(
  menu: { x: number; y: number } | null,
  items: MenuItem[],
  onClose: () => void,
): boolean {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (menu === null || failed) return;
    let cancelled = false;
    popupNativeMenu(items, menu.x, menu.y).then(
      () => !cancelled && onClose(),
      (err: unknown) => {
        console.error("native menu", err);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
    // Jen při otevření nového menu; položky a onClose se mezi tím mění s každým renderem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, failed]);

  return !failed;
}
