import { type ResolvedAgent } from "@cockpit-ai/core";
import { loadAgentsFromDir } from "./loader.js";

// ─── Agent Registry ─────────────────────────────────────────────────────────

export class AgentRegistry {
  private agents = new Map<string, ResolvedAgent>();

  add(agent: ResolvedAgent): void {
    this.agents.set(agent.name, agent);
  }

  get(name: string): ResolvedAgent | undefined {
    return this.agents.get(name);
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  list(): ResolvedAgent[] {
    return [...this.agents.values()];
  }

  remove(name: string): boolean {
    return this.agents.delete(name);
  }

  size(): number {
    return this.agents.size;
  }

  /**
   * Load all agents from one or more directories into the registry.
   * Returns any load errors encountered.
   */
  loadFromDirs(dirs: string[]): Array<{ file: string; error: unknown }> {
    const allErrors: Array<{ file: string; error: unknown }> = [];

    for (const dir of dirs) {
      const { agents, errors } = loadAgentsFromDir(dir);
      for (const agent of agents) {
        this.add(agent);
      }
      allErrors.push(...errors);
    }

    return allErrors;
  }
}
