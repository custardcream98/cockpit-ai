import chalk from "chalk";

// ─── Basic output helpers ──────────────────────────────────────────────────

export const ui = {
  success: (msg: string) => console.log(chalk.green("✓") + " " + msg),
  error: (msg: string) => console.error(chalk.red("✗") + " " + msg),
  warn: (msg: string) => console.warn(chalk.yellow("!") + " " + msg),
  info: (msg: string) => console.log(chalk.blue("→") + " " + msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  heading: (msg: string) => console.log("\n" + chalk.bold(msg)),
  blank: () => console.log(),
  /** --verbose 플래그가 설정된 경우에만 출력 */
  verbose: (msg: string) => {
    if (process.env["COCKPIT_VERBOSE"] === "1") {
      console.log(chalk.magenta("[verbose]") + " " + chalk.dim(msg));
    }
  },
};

export function formatKey(key: string): string {
  return chalk.cyan(key);
}

export function formatValue(value: string | null | undefined): string {
  if (value == null || value === "") return chalk.dim("(none)");
  return chalk.white(value);
}

export function formatList(items: string[]): string {
  if (items.length === 0) return chalk.dim("(empty)");
  return items.map((i) => chalk.white(i)).join(", ");
}

export function printKeyValue(key: string, value: string | null | undefined): void {
  console.log(`  ${formatKey(key.padEnd(20))} ${formatValue(value)}`);
}

export function printKeyList(key: string, items: string[]): void {
  console.log(`  ${formatKey(key.padEnd(20))} ${formatList(items)}`);
}
