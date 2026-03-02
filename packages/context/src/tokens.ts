import type { ContextRule } from "@cockpit-ai/core";

// ─── Token Estimation ─────────────────────────────────────────────────────────

/**
 * 텍스트의 토큰 수를 근사치로 계산.
 * Claude의 실제 토크나이저와 정확히 일치하지 않지만,
 * 4자 ≈ 1토큰 기준으로 빠른 근사치를 제공.
 */
export function estimateTokens(text: string): number {
  // 영어 기준: ~4자 = 1토큰 (공백/구두점 포함)
  return Math.ceil(text.length / 4);
}

// ─── Rule Token Stats ─────────────────────────────────────────────────────────

export interface RuleTokenStat {
  rule: ContextRule;
  tokens: number;
  percentage?: number;
}

export interface TokenStats {
  rules: RuleTokenStat[];
  totalTokens: number;
  globalTokens: number;
  projectTokens: number;
}

/**
 * 룰 목록의 토큰 사용량 통계를 계산.
 */
export function computeTokenStats(rules: ContextRule[]): TokenStats {
  const ruleStats: RuleTokenStat[] = rules.map((rule) => ({
    rule,
    tokens: estimateTokens(rule.content),
  }));

  const totalTokens = ruleStats.reduce((sum, s) => sum + s.tokens, 0);
  const globalTokens = ruleStats
    .filter((s) => s.rule.scope === "global")
    .reduce((sum, s) => sum + s.tokens, 0);
  const projectTokens = ruleStats
    .filter((s) => s.rule.scope === "project")
    .reduce((sum, s) => sum + s.tokens, 0);

  // 비율 계산
  const withPercentage = ruleStats.map((s) => ({
    ...s,
    percentage: totalTokens > 0 ? Math.round((s.tokens / totalTokens) * 100) : 0,
  }));

  return {
    rules: withPercentage,
    totalTokens,
    globalTokens,
    projectTokens,
  };
}
