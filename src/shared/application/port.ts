import type { Port } from "./port.types";

export function definePort<T>(name: string): Port<T> {
  let adapter: T | null = null;
  return {
    name,
    get() {
      // i18n-ignore – chyba pro vývojáře, ne text UI
      if (adapter === null) throw new Error(`Port ${name} nemá adaptér (src/app/composition)`);
      return adapter;
    },
    provide(next) {
      adapter = next;
    },
  };
}
