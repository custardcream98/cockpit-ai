export { ClaudeCodeAdapter } from "./claude-code/index.js";
export { CursorAdapter } from "./cursor/index.js";
export { OpenCodeAdapter } from "./opencode/index.js";

import { ClaudeCodeAdapter } from "./claude-code/index.js";
import { CursorAdapter } from "./cursor/index.js";
import { OpenCodeAdapter } from "./opencode/index.js";
import { type CockpitAdapter, type AdapterName } from "@cockpit/core";

// ─── Registry ──────────────────────────────────────────────────────────────

const ADAPTERS: Record<string, CockpitAdapter> = {
  "claude-code": new ClaudeCodeAdapter(),
  "cursor": new CursorAdapter(),
  "opencode": new OpenCodeAdapter(),
};

export function getAdapter(name: AdapterName): CockpitAdapter | null {
  return ADAPTERS[name] ?? null;
}

export function getAdapters(names: AdapterName[]): CockpitAdapter[] {
  return names.flatMap((name) => {
    const adapter = getAdapter(name);
    return adapter ? [adapter] : [];
  });
}
