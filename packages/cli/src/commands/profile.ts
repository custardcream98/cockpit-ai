import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { stringify as yamlStringify } from "yaml";
import {
  ProfileConfigSchema,
  WorkspaceConfigSchema,
  getProfilePath,
  getProfileDir,
  tryLoadConfig,
  findConfigPaths,
  resolveConfig,
} from "@cockpit/core";
import { ui, printKeyValue } from "../ui/output.js";

// ─── Prompt Helpers ────────────────────────────────────────────────────────

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const display = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(display, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

// ─── YAML Template ────────────────────────────────────────────────────────

function profileTemplate(opts: {
  name: string;
  language: string;
  defaultModel: string;
  defaultAdapter: string;
}): string {
  return `cockpit: "1.0"

profile:
  name: ${opts.name}
  sync:
    remote: ""
    auto_sync: false

preferences:
  language: ${opts.language}
  default_model: ${opts.defaultModel}
  default_adapter: ${opts.defaultAdapter}

context:
  global: []
`;
}

// ─── Git Helpers ──────────────────────────────────────────────────────────

function runGit(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, stdio: "pipe" }).toString().trim();
}

function isGitRepo(dir: string): boolean {
  try {
    runGit("rev-parse --is-inside-work-tree", dir);
    return true;
  } catch {
    return false;
  }
}

function hasCommits(dir: string): boolean {
  try {
    runGit("rev-parse HEAD", dir);
    return true;
  } catch {
    return false;
  }
}

function hasRemote(dir: string): boolean {
  try {
    const remotes = runGit("remote", dir);
    return remotes.trim().length > 0;
  } catch {
    return false;
  }
}

// ─── profile show ──────────────────────────────────────────────────────────

export async function profileShowCommand(): Promise<void> {
  const profilePath = getProfilePath();
  const profileDir = getProfileDir();

  ui.heading("Cockpit Profile");

  printKeyValue("Profile dir", profileDir);
  printKeyValue("Profile file", profilePath);
  ui.blank();

  if (!existsSync(profilePath)) {
    ui.warn("No profile found.");
    ui.info("Run 'cockpit profile create' to set up your profile.");
    return;
  }

  const profile = tryLoadConfig(profilePath, ProfileConfigSchema);

  if (!profile) {
    ui.error(`Failed to load profile from ${profilePath}`);
    ui.info("The file may be corrupted. Run 'cockpit profile create' to recreate it.");
    return;
  }

  // ── Profile identity ───────────────────────────────────────────────────
  if (profile.profile) {
    printKeyValue("Name", profile.profile.name);

    if (profile.profile.sync) {
      const sync = profile.profile.sync;
      printKeyValue("Sync remote", sync.remote ?? "(none)");
      printKeyValue("Auto sync", sync.auto_sync ? "yes" : "no");
    }
    ui.blank();
  }

  // ── Preferences ────────────────────────────────────────────────────────
  if (profile.preferences) {
    ui.dim("Preferences");
    printKeyValue("Language", profile.preferences.language);
    printKeyValue("Default model", profile.preferences.default_model);
    printKeyValue("Default adapter", profile.preferences.default_adapter);
    ui.blank();
  }

  // ── Context rules ──────────────────────────────────────────────────────
  if (profile.context?.global && profile.context.global.length > 0) {
    ui.dim("Global context rules");
    for (const rule of profile.context.global) {
      console.log(`    • ${rule}`);
    }
    ui.blank();
  }

  // ── Git sync status ────────────────────────────────────────────────────
  const profileDirResolved = resolve(profileDir);
  if (existsSync(profileDirResolved)) {
    ui.dim("Sync status");
    if (isGitRepo(profileDirResolved)) {
      printKeyValue("Git repo", "yes");
      try {
        const branch = runGit("rev-parse --abbrev-ref HEAD", profileDirResolved);
        printKeyValue("Branch", branch);
        if (hasRemote(profileDirResolved)) {
          const remote = runGit("remote get-url origin", profileDirResolved);
          printKeyValue("Remote origin", remote);
        } else {
          printKeyValue("Remote origin", "(none)");
        }
      } catch {
        // Non-fatal: skip detailed git info
      }
    } else {
      printKeyValue("Git repo", "no");
      ui.dim("  Run 'cockpit profile sync push' to initialize git sync.");
    }
    ui.blank();
  }
}

// ─── profile create ────────────────────────────────────────────────────────

export async function profileCreateCommand(): Promise<void> {
  const profilePath = getProfilePath();
  const profileDir = getProfileDir();

  ui.heading("Create Cockpit Profile");
  ui.info(`Profile will be saved to: ${profilePath}`);
  ui.blank();

  if (existsSync(profilePath)) {
    const existing = tryLoadConfig(profilePath, ProfileConfigSchema);
    const existingName = existing?.profile?.name;
    ui.warn(`A profile already exists${existingName ? ` for '${existingName}'` : ""}.`);
    const overwrite = await prompt("Overwrite? [y/N]", "N");
    if (overwrite.toLowerCase() !== "y") {
      ui.info("Aborted. Existing profile unchanged.");
      return;
    }
    ui.blank();
  }

  const name = await prompt("Your name", process.env["USER"] ?? "");
  const language = await prompt("Preferred language code (e.g. en, ko, ja)", "en");
  const defaultModel = await prompt("Default AI model", "claude-sonnet-4-6");
  const defaultAdapter = await prompt(
    "Default adapter (claude-code, cursor, copilot, opencode)",
    "claude-code"
  );

  const validAdapters = ["claude-code", "cursor", "copilot", "opencode"];
  if (!validAdapters.includes(defaultAdapter)) {
    ui.error(`Invalid adapter '${defaultAdapter}'. Must be one of: ${validAdapters.join(", ")}`);
    process.exit(1);
  }

  mkdirSync(profileDir, { recursive: true });

  const content = profileTemplate({ name, language, defaultModel, defaultAdapter });
  writeFileSync(profilePath, content, "utf-8");

  ui.blank();
  ui.success(`Profile created at ${profilePath}`);
  ui.blank();
  ui.dim("Next steps:");
  ui.dim("  cockpit profile show         — view your profile");
  ui.dim("  cockpit profile sync push    — sync profile to a remote git repo");
  ui.dim("  cockpit status               — view merged environment config");
}

// ─── profile sync push ─────────────────────────────────────────────────────

export async function profileSyncPushCommand(): Promise<void> {
  const profilePath = getProfilePath();
  const profileDir = resolve(getProfileDir());

  if (!existsSync(profilePath)) {
    ui.error("No profile found.");
    ui.info("Run 'cockpit profile create' first.");
    process.exit(1);
  }

  const profile = tryLoadConfig(profilePath, ProfileConfigSchema);
  const remote = profile?.profile?.sync?.remote;

  ui.heading("Profile Sync — Push");

  // Ensure profile dir exists
  mkdirSync(profileDir, { recursive: true });

  // Init git repo if needed
  if (!isGitRepo(profileDir)) {
    ui.info("Initializing git repository in profile directory...");
    try {
      runGit("init", profileDir);
      ui.success("Git repository initialized.");
    } catch (err) {
      ui.error(`Failed to initialize git repo: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // Add remote if configured but not yet set
  if (remote && remote.trim() !== "") {
    try {
      const existingRemotes = runGit("remote", profileDir);
      if (!existingRemotes.split("\n").includes("origin")) {
        runGit(`remote add origin ${remote}`, profileDir);
        ui.success(`Remote 'origin' set to: ${remote}`);
      }
    } catch (err) {
      ui.warn(`Could not configure remote: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Stage all files
  try {
    runGit("add .", profileDir);
  } catch (err) {
    ui.error(`Failed to stage files: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Check if there is anything to commit
  let hasChanges = false;
  try {
    const status = runGit("status --porcelain", profileDir);
    hasChanges = status.trim().length > 0;
  } catch {
    hasChanges = true; // Assume there are changes if we can't check
  }

  if (hasChanges || !hasCommits(profileDir)) {
    try {
      runGit(`commit -m "sync"`, profileDir);
      ui.success("Committed profile changes.");
    } catch (err) {
      // Commit may fail if nothing to commit (e.g., after a clean add)
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("nothing to commit")) {
        ui.error(`Failed to commit: ${msg}`);
        process.exit(1);
      } else {
        ui.info("Nothing new to commit.");
      }
    }
  } else {
    ui.info("Nothing new to commit.");
  }

  // Push to remote
  if (remote && remote.trim() !== "") {
    ui.info(`Pushing to remote: ${remote}`);
    try {
      // Determine current branch name
      let branch = "main";
      try {
        branch = runGit("rev-parse --abbrev-ref HEAD", profileDir);
      } catch {
        // Fallback to "main"
      }
      runGit(`push -u origin ${branch}`, profileDir);
      ui.success("Profile pushed to remote.");
    } catch (err) {
      ui.error(`Push failed: ${err instanceof Error ? err.message : String(err)}`);
      ui.dim("Ensure the remote is accessible and you have push permissions.");
      process.exit(1);
    }
  } else {
    ui.warn("No remote configured in profile.sync.remote — skipping push.");
    ui.dim("Edit your profile and add a 'sync.remote' URL, then run this command again.");
  }

  ui.blank();
}

// ─── profile sync pull ─────────────────────────────────────────────────────

export async function profileSyncPullCommand(): Promise<void> {
  const profilePath = getProfilePath();
  const profileDir = resolve(getProfileDir());

  ui.heading("Profile Sync — Pull");

  // Load profile to get remote (if profile exists)
  const profile = tryLoadConfig(profilePath, ProfileConfigSchema);
  const remote = profile?.profile?.sync?.remote;

  if (!existsSync(profileDir) || !isGitRepo(profileDir)) {
    // Profile dir doesn't exist or isn't a git repo
    if (remote && remote.trim() !== "") {
      ui.info(`Cloning profile from remote: ${remote}`);
      try {
        // Clone into the parent, targeting profileDir name
        const parentDir = resolve(profileDir, "..");
        const dirName = profileDir.split("/").at(-1) ?? ".cockpit";
        mkdirSync(parentDir, { recursive: true });
        execSync(`git clone ${remote} ${dirName}`, { cwd: parentDir, stdio: "pipe" });
        ui.success("Profile cloned from remote.");
      } catch (err) {
        ui.error(`Clone failed: ${err instanceof Error ? err.message : String(err)}`);
        ui.dim(`Remote: ${remote}`);
        process.exit(1);
      }
    } else {
      ui.error("Profile directory is not a git repository and no remote is configured.");
      ui.info("Run 'cockpit profile create' and configure 'sync.remote' first.");
      process.exit(1);
    }
  } else {
    // It is already a git repo — pull
    if (!hasRemote(profileDir)) {
      ui.error("No git remote configured in the profile directory.");
      if (remote && remote.trim() !== "") {
        ui.info("Adding remote from profile config...");
        try {
          runGit(`remote add origin ${remote}`, profileDir);
          ui.success(`Remote 'origin' set to: ${remote}`);
        } catch (err) {
          ui.error(`Failed to add remote: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      } else {
        ui.dim("Set 'sync.remote' in your profile.yaml and try again.");
        process.exit(1);
      }
    }

    ui.info("Pulling latest changes from remote...");
    try {
      runGit("pull", profileDir);
      ui.success("Profile updated from remote.");
    } catch (err) {
      ui.error(`Pull failed: ${err instanceof Error ? err.message : String(err)}`);
      ui.dim("Check your network connection and remote access permissions.");
      process.exit(1);
    }
  }

  ui.blank();
  ui.dim("Run 'cockpit profile show' to view the updated profile.");
  ui.blank();
}

// ─── profile export ────────────────────────────────────────────────────────

export async function profileExportCommand(outputFile?: string): Promise<void> {
  const profilePath = getProfilePath();
  const cwd = process.cwd();
  const outPath = resolve(outputFile ?? "cockpit-profile-export.yaml");

  ui.heading("Profile Export");

  if (!existsSync(profilePath)) {
    ui.error("No profile found.");
    ui.info("Run 'cockpit profile create' first.");
    process.exit(1);
  }

  // Load profile
  const profile = tryLoadConfig(profilePath, ProfileConfigSchema);
  if (!profile) {
    ui.error(`Failed to load profile from ${profilePath}`);
    process.exit(1);
  }

  // Resolve merged config (profile + any workspace/project in cwd)
  const paths = findConfigPaths(cwd);
  paths.profilePath = profilePath;

  let workspaceConfig = null;
  if (paths.workspacePath) {
    workspaceConfig = tryLoadConfig(paths.workspacePath, WorkspaceConfigSchema);
  }

  const resolved = resolveConfig(paths);

  // Build export document
  const exportedAt = new Date().toISOString();

  // Reconstruct a merged profile-like object for export
  const exportDoc: Record<string, unknown> = {
    cockpit: "1.0",
    exported_at: exportedAt,
  };

  if (profile.profile) {
    exportDoc["profile"] = profile.profile;
  }

  // Merged preferences from resolved config
  exportDoc["preferences"] = {
    language: resolved.preferences.language,
    default_model: resolved.preferences.defaultModel,
    default_adapter: resolved.defaultAdapter,
  };

  // Merged context
  if (resolved.context.global.length > 0 || resolved.context.project.length > 0) {
    const contextExport: Record<string, string[]> = {};
    if (resolved.context.global.length > 0) {
      contextExport["global"] = resolved.context.global;
    }
    if (resolved.context.project.length > 0) {
      contextExport["project"] = resolved.context.project;
    }
    exportDoc["context"] = contextExport;
  }

  // Include workspace info if present
  if (workspaceConfig?.workspace) {
    exportDoc["workspace"] = workspaceConfig.workspace;
  }

  // Include adapters list
  if (resolved.adapters.length > 0) {
    exportDoc["adapters"] = resolved.adapters;
  }

  // Serialize
  const header = `# Cockpit Profile Export — generated by cockpit profile export\n`;
  const body = yamlStringify(exportDoc, { lineWidth: 0 });

  writeFileSync(outPath, header + body, "utf-8");

  ui.blank();
  ui.success(`Exported to: ${outPath}`);
  ui.blank();
  ui.dim(`Profile: ${profilePath}`);
  if (paths.workspacePath) {
    ui.dim(`Workspace: ${paths.workspacePath}`);
  }
  ui.dim(`Exported at: ${exportedAt}`);
  ui.blank();
}

// ─── profile import ────────────────────────────────────────────────────────

export async function profileImportCommand(inputFile: string): Promise<void> {
  const inputPath = resolve(inputFile);
  const profilePath = getProfilePath();
  const profileDir = getProfileDir();

  ui.heading("Profile Import");
  ui.info(`Importing from: ${inputPath}`);
  ui.blank();

  if (!existsSync(inputPath)) {
    ui.error(`Import file not found: ${inputPath}`);
    process.exit(1);
  }

  // Read and parse the export file
  let rawContent = "";
  try {
    rawContent = readFileSync(inputPath, "utf-8");
  } catch (err) {
    ui.error(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let parsed: unknown = null;
  try {
    const { parse: parseYaml } = await import("yaml");
    parsed = parseYaml(rawContent);
  } catch (err) {
    ui.error(`Invalid YAML in import file: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Validate that it looks like an export file
  if (typeof parsed !== "object" || parsed === null) {
    ui.error("Import file does not contain a valid Cockpit export document.");
    process.exit(1);
  }

  const doc = parsed as Record<string, unknown>;

  if (doc["cockpit"] === undefined) {
    ui.warn("Import file does not have a 'cockpit' version field. Proceeding with caution.");
  }

  // Warn about overwriting existing profile
  if (existsSync(profilePath)) {
    const existing = tryLoadConfig(profilePath, ProfileConfigSchema);
    const existingName = existing?.profile?.name;
    ui.warn(`An existing profile${existingName ? ` for '${existingName}'` : ""} will be overwritten.`);
    const overwrite = await prompt("Continue? [y/N]", "N");
    if (overwrite.toLowerCase() !== "y") {
      ui.info("Aborted. Existing profile unchanged.");
      return;
    }
    ui.blank();
  }

  // Build a profile.yaml from the import
  const profileDoc: Record<string, unknown> = {
    cockpit: doc["cockpit"] ?? "1.0",
  };

  if (doc["profile"] !== undefined) {
    profileDoc["profile"] = doc["profile"];
  }

  if (doc["preferences"] !== undefined) {
    profileDoc["preferences"] = doc["preferences"];
  }

  if (doc["context"] !== undefined) {
    profileDoc["context"] = doc["context"];
  }

  // Validate the resulting profile document
  const profileResult = ProfileConfigSchema.safeParse(profileDoc);
  if (!profileResult.success) {
    ui.error("Import file does not contain a valid profile configuration:");
    for (const issue of profileResult.error.issues) {
      ui.dim(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  // Write the profile
  mkdirSync(profileDir, { recursive: true });
  const profileYaml = yamlStringify(profileDoc, { lineWidth: 0 });
  writeFileSync(profilePath, profileYaml, "utf-8");

  ui.success(`Profile imported to: ${profilePath}`);

  // Optionally inform about workspace config in the export
  if (doc["workspace"] !== undefined && doc["adapters"] !== undefined) {
    ui.blank();
    ui.info("The export file also contains workspace configuration.");
    ui.dim("Workspace settings were NOT imported (they belong in .cockpit/config.yaml).");
    ui.dim("Run 'cockpit init' in your workspace to create a workspace config.");
  }

  ui.blank();
  ui.dim("Run 'cockpit profile show' to verify the imported profile.");
  ui.blank();
}
