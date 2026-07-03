const BAR_WIDTH = 20;

export function printProgress(phase: string, label: string, pct: number) {
  const filled = Math.round((pct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  process.stderr.write(`  ${phase} ${bar} ${String(Math.round(pct)).padStart(3)}%  ${label}\n`);
}

export function printDone(label: string) {
  const bar = "█".repeat(BAR_WIDTH);
  process.stderr.write(`  ✔ ${bar} 100%  ${label}\n`);
}

/** 力导仿真逐 tick 进度（不显示百分比条，直接输出状态行） */
export function printTick(tick: number, total: number, alpha: number, nodeCount: number) {
  const pct = total > 0 ? `${Math.round((tick / total) * 100)}%` : "···";
  process.stderr.write(
    `     tick ${String(tick).padStart(4)}/${total > 0 ? total : "∞"}  α=${alpha.toFixed(4)}  ${nodeCount} 节点  (${pct})\n`,
  );
}
