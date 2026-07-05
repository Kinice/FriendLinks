/**
 * bun run six — 博客宇宙六度分隔报告
 */
import { loadSites } from "../src/utils/load-sites";
import { buildGraph, getStats } from "../tools/six-degrees";

const sites = await loadSites("links");
const graph = buildGraph(sites);
const stats = getStats(graph);

console.log(`\n🌌 博客宇宙六度分隔报告`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`节点总数：${stats.nodeCount.toLocaleString()}`);
console.log(`边（互链关系）：${stats.edgeCount.toLocaleString()}`);
console.log(`孤立节点：${stats.isolatedCount.toLocaleString()}`);
console.log();
console.log(`连通分量：${stats.componentCount} 个`);
for (const b of stats.compSizeDistribution) {
  console.log(`  ${b.label.padEnd(12)} ${b.count.toLocaleString().padStart(6)} 个`);
}
console.log();
console.log(`最远两点之间需要  ${stats.diameter}  度（全图直径）`);
console.log(`全图平均距离      ${stats.averagePathLength.toFixed(2)} 度`);
console.log(`总可达对          ${stats.reachablePairs.toLocaleString()}`);
console.log();
console.log(`距离分布：`);
for (const [dist, count] of [...stats.distanceDistribution.entries()].sort((a, b) => a[0] - b[0])) {
  const pct = ((count / stats.reachablePairs) * 100).toFixed(1);
  const bar = "█".repeat(Math.round(parseFloat(pct)));
  console.log(`  ${String(dist).padStart(2)} 度  ${String(count).padStart(9)} 对  ${pct.padStart(5)}%  ${bar}`);
}
