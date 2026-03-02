import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import lockfile from "proper-lockfile";

// ─── File Lock ──────────────────────────────────────────────────────────────

/**
 * 파일에 대해 exclusive lock을 획득하고 콜백 실행 후 해제.
 * 대상 파일이 없으면 빈 JSON 객체로 생성.
 * 멀티 에이전트 동시 실행 시 상태 파일 corruption 방지.
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
): Promise<T> {
  // 파일이 없으면 lockfile이 실패하므로 미리 생성
  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, "{}", "utf-8");
  }

  const release = await lockfile.lock(filePath, {
    retries: { retries: 5, minTimeout: 50, maxTimeout: 200 },
  });

  try {
    return await fn();
  } finally {
    await release();
  }
}
