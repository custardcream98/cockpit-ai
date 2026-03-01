import { type ResolvedSkill } from "@cockpit/core";
import { loadSkillsFromDir } from "./loader.js";

// ─── Skill Registry ────────────────────────────────────────────────────────

export class SkillRegistry {
  private skills = new Map<string, ResolvedSkill>();

  add(skill: ResolvedSkill): void {
    this.skills.set(skill.name, skill);
  }

  get(name: string): ResolvedSkill | undefined {
    return this.skills.get(name);
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  list(): ResolvedSkill[] {
    return [...this.skills.values()];
  }

  remove(name: string): boolean {
    return this.skills.delete(name);
  }

  size(): number {
    return this.skills.size;
  }

  /**
   * Load all skills from one or more directories into the registry.
   * Returns any load errors encountered.
   */
  loadFromDirs(dirs: string[]): Array<{ file: string; error: unknown }> {
    const allErrors: Array<{ file: string; error: unknown }> = [];

    for (const dir of dirs) {
      const { skills, errors } = loadSkillsFromDir(dir);
      for (const skill of skills) {
        this.add(skill);
      }
      allErrors.push(...errors);
    }

    return allErrors;
  }
}
