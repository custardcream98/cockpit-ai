import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigValidationError } from "@cockpit/core";
import { loadSkillFromFile, loadSkillsFromDir } from "../loader.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-skills-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeSkill(name: string, content: string): string {
  const path = join(tmpDir, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

const VALID_SKILL = `
name: code-review
version: 1.0.0
description: Comprehensive code review
trigger:
  - "/review"
prompt: |
  Review the code carefully.
tools:
  - read
  - grep
adapters:
  claude-code:
    type: command
`;

describe("loadSkillFromFile", () => {
  it("loads a valid skill", () => {
    const path = writeSkill("code-review.yaml", VALID_SKILL);
    const skill = loadSkillFromFile(path);
    expect(skill.name).toBe("code-review");
    expect(skill.version).toBe("1.0.0");
    expect(skill.description).toBe("Comprehensive code review");
    expect(skill.trigger).toContain("/review");
    expect(skill.tools).toContain("read");
  });

  it("resolves adapterConfig correctly", () => {
    const path = writeSkill("skill.yaml", VALID_SKILL);
    const skill = loadSkillFromFile(path);
    expect(skill.adapterConfig["claude-code"]?.type).toBe("command");
  });

  it("defaults to empty arrays for optional fields", () => {
    const path = writeSkill("minimal.yaml", "name: minimal\nprompt: Do stuff.\n");
    const skill = loadSkillFromFile(path);
    expect(skill.trigger).toEqual([]);
    expect(skill.tools).toEqual([]);
  });

  it("throws ConfigValidationError on invalid skill", () => {
    const path = writeSkill("bad.yaml", "name: bad\n# missing prompt\n");
    expect(() => loadSkillFromFile(path)).toThrow(ConfigValidationError);
  });
});

describe("loadSkillsFromDir", () => {
  it("loads all yaml files from directory", () => {
    writeSkill("skill1.yaml", VALID_SKILL);
    writeSkill("skill2.yaml", VALID_SKILL.replace("code-review", "another-skill"));
    const { skills, errors } = loadSkillsFromDir(tmpDir);
    expect(skills).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("skips non-yaml files", () => {
    writeSkill("skill.yaml", VALID_SKILL);
    writeSkill("notes.txt", "this is a text file");
    writeSkill("config.json", '{"hello": "world"}');
    const { skills } = loadSkillsFromDir(tmpDir);
    expect(skills).toHaveLength(1);
  });

  it("collects errors for invalid skills without throwing", () => {
    writeSkill("valid.yaml", VALID_SKILL);
    writeSkill("invalid.yaml", "name: broken\n# missing prompt\n");
    const { skills, errors } = loadSkillsFromDir(tmpDir);
    expect(skills).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it("returns empty result for non-existent directory", () => {
    const { skills, errors } = loadSkillsFromDir(join(tmpDir, "nonexistent"));
    expect(skills).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});
