import { type ResolvedAgent } from "./agent.js";
import { type ResolvedSkill } from "./skill.js";
import { type ResolvedContext } from "./context.js";

// ─── Adapter Interface ─────────────────────────────────────────────────────

export interface CockpitAdapter {
  readonly name: string;

  /** Detect if this tool is used in the given project */
  detect(projectPath: string): Promise<boolean>;

  /** Convert a Cockpit skill to the tool's native format */
  applySkill(projectPath: string, skill: ResolvedSkill): Promise<void>;

  /** Convert Cockpit context to the tool's native format */
  applyContext(projectPath: string, context: ResolvedContext): Promise<void>;

  /** Convert a Cockpit agent definition to the tool's native format */
  applyAgent(projectPath: string, agent: ResolvedAgent): Promise<void>;

  /** Clean up tool-specific config files */
  clean(projectPath: string): Promise<void>;
}
