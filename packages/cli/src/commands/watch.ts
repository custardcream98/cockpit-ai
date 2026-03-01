import { watch, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { findConfigPaths } from "@cockpit-ai/core";
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

  // 동시 실행 방지 플래그
  let isApplying = false;
  let pendingApply = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // applyCommand를 안전하게 실행 (에러 catch, 동시 실행 방지)
  async function runApply(filename: string): Promise<void> {
    if (isApplying) {
      // 현재 실행 중이면 pending 표시 → 완료 후 재실행
      pendingApply = true;
      return;
    }

    isApplying = true;
    try {
      ui.info(`Changed: ${filename} — re-applying…`);
      await applyCommand({});
    } catch (err) {
      ui.error(`Apply failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      isApplying = false;
      if (pendingApply) {
        pendingApply = false;
        await runApply("(pending)");
      }
    }
  }

  const schedule = (filename: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    // runApply 내부에서 모든 에러를 catch하므로 void로 안전하게 처리
    debounceTimer = setTimeout(() => {
      void runApply(filename);
    }, 300);
  };

  for (const dir of watchDirs) {
    const watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (!filename.endsWith(".yaml") && !filename.endsWith(".md")) return;
      schedule(filename);
    });

    // fs.watch 에러 핸들링 (일부 플랫폼에서 발생 가능)
    watcher.on("error", (err) => {
      ui.error(`Watch error on ${dir}: ${err.message}`);
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
