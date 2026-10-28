import type { cs } from "./cs";

export type Locale = "en" | "cs" | "es";

export type LanguageSetting = "system" | Locale;

export type MessageKey = keyof typeof cs;

export type Params = Record<string, string | number>;

export type Translate = (key: MessageKey, params?: Params) => string;

export type Plural = { one: string; few?: string; many?: string; other: string };

export type Message = string | Plural;
