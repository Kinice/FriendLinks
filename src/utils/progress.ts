const BAR_WIDTH = 24;

export function printProgress(phase: string, label: string, pct: number) {
  const filled = Math.round((pct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  process.stderr.write(`\r  ${phase} ${bar} ${String(Math.round(pct)).padStart(3)}%  ${label}`);
}

export function printDone(label: string) {
  const bar = "█".repeat(BAR_WIDTH);
  process.stderr.write(`\r  ✔ ${bar} 100%  ${label}\n`);
}
