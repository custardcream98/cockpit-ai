import { watch, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { findConfigPaths, COCKPIT_DIR } from "@cockpit-ai/core";
import { applyCommand } from "./apply.js";
import { ui } from "../ui/output.js";

// ─── Watch Command ──────────────────────────────────────────────────────────

export async function watchCommand(): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  // Collect all .cockpit/ directories to watch
  const watchDirs: string[] = [];

  if (paths.workspacePath) {
    const dir = resolve(join(paths.workspacePath, ".."));
    if (existsSync(dir)) watchDirs.push(dir);
  }
  if (paths.projectPath) {
    const dir = resolve(join(paths.projectPath, ".."));
    if (existsSync(dir) && !watchDirs.includes(dir)) watchDirs.push(dir);
  }

  ui.heading("Cockpit Watch");
  for (const dir of watchDirs) ui.dim(`Watching ${dir}`);
  ui.blank();

  // Run apply immediately on start
  await applyCommand({});

  // Debounce state
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (filename: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      ui.info(`Changed: ${filename} — re-applying…`);
      await applyCommand({});
    }, 300);
  };

  for (const dir of watchDirs) {
    watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (!filename.endsWith(".yaml") && !filename.endsWith(".md")) return;
      schedule(filename);
    });
  }

  // Keep process alive
  process.stdin.resume();

  process.on("SIGINT", () => {
    ui.blank();
    ui.dim("Watch stopped.");
    process.exit(0);
  });
}
