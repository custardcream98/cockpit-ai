export { ClaudeCodeAdapter } from "./claude-code/index.js";

import { ClaudeCodeAdapter } from "./claude-code/index.js";
import { type CockpitAdapter, type AdapterName } from "@cockpit/core";

// ─── Registry ──────────────────────────────────────────────────────────────

const ADAPTERS: Record<string, CockpitAdapter> = {
  "claude-code": new ClaudeCodeAdapter(),
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
