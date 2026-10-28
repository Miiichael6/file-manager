import type { FileEntry } from "../domain/types";

export type DirListing = { entries: FileEntry[]; more: boolean };

export type DirChunk = { token: number; entries: FileEntry[]; done: boolean };
