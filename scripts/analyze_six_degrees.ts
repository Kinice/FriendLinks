#!/usr/bin/env bun
/**
 * 六度分隔理论节点级分析
 * 找出"边缘化"节点：离心率超过 6 度，或与大量节点距离 > 6 的节点
 *
 * 用法: bun scripts/analyze_six_degrees.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALL_JSON = resolve(__dirname, "..", "dist", "all.json");

interface Site {
  name: string;
  url: string;
  description?: string;
  friends?: { name: string; url: string }[];
}

interface AllData {
  count: number;
  sites: Site[];
}

/** BFS 计算 start 到所有其他节点的最短距离（边数），不可达为 -1 */
function bfsDistance(adj: number[][], start: number): Int32Array {
  const n = adj.length;
  const dist = new Int32Array(n).fill(-1);
  dist[start] = 0;
  const q: number[] = [start];
  let head = 0;
  while (head < q.length) {
    const u = q[head++];
    for (const v of adj[u]) {
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1;
        q.push(v);
      }
    }
  }
  return dist;
}

function main(): void {
  console.error(`读取 ${ALL_JSON} ...`);
  const raw = readFileSync(ALL_JSON, "utf-8");
  const data = JSON.parse(raw) as AllData;

  const sites = data.sites;

  // 收集所有 URL
  const urlSet = new Set<string>();
  const urlToName = new Map<string, string>();
  for (const site of sites) {
    urlSet.add(site.url);
    urlToName.set(site.url, site.name);
    for (const friend of site.friends ?? []) {
      urlSet.add(friend.url);
      if (!urlToName.has(friend.url)) {
        urlToName.set(friend.url, friend.name);
      }
    }
  }

  const allUrls = [...urlSet].sort();
  const urlToIdx = new Map<string, number>();
  allUrls.forEach((u, i) => urlToIdx.set(u, i));

  const n = allUrls.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const isCoreNode = new Set<number>();

  for (const site of sites) {
    const src = urlToIdx.get(site.url)!;
    isCoreNode.add(src);
    for (const friend of site.friends ?? []) {
      const dst = urlToIdx.get(friend.url)!;
      adj[src].push(dst);
      adj[dst].push(src);
    }
  }

  console.error(`总节点数: ${n}`);
  console.error(`核心节点数: ${isCoreNode.size}`);

  // 找连通分量
  const component = new Int32Array(n).fill(-1);
  const compNodesMap = new Map<number, number[]>();
  let compId = 0;

  for (let i = 0; i < n; i++) {
    if (component[i] !== -1) continue;
    const q: number[] = [i];
    component[i] = compId;
    const nodes: number[] = [];
    let head = 0;
    while (head < q.length) {
      const u = q[head++];
      nodes.push(u);
      for (const v of adj[u]) {
        if (component[v] === -1) {
          component[v] = compId;
          q.push(v);
        }
      }
    }
    compNodesMap.set(compId, nodes);
    compId++;
  }

  console.error(`连通分量数: ${compId}`);

  // 按大小排序
  const sortedComps = [...compNodesMap.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  interface NodeStats {
    idx: number;
    url: string;
    name: string;
    isCore: boolean;
    eccentricity: number; // max distance to any node in same component
    beyondSixCount: number; // how many nodes are at distance > 6
    beyondSixRatio: number; // ratio of nodes > 6 away
    sumDist: number; // sum of all distances (for avg)
    avgDist: number;
  }

  const allStats: NodeStats[] = [];
  const startTime = Date.now();
  let processedNodes = 0;

  // 只分析最大的连通分量（包含绝大多数节点）
  const mainComp = sortedComps[0];
  const mainCompNodes = mainComp[1];

  console.error(`\n主分量大小: ${mainCompNodes.length}`);
  console.error(`开始逐节点 BFS 分析...\n`);

  for (let aIdx = 0; aIdx < mainCompNodes.length; aIdx++) {
    if (aIdx % 500 === 0 || aIdx === mainCompNodes.length - 1) {
      const progress = ((aIdx + 1) / mainCompNodes.length) * 100;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stderr.write(
        `\r  进度: ${progress.toFixed(1)}%  (节点 ${aIdx + 1}/${mainCompNodes.length})  ${elapsed}s`,
      );
    }

    const a = mainCompNodes[aIdx];
    const dist = bfsDistance(adj, a);

    let maxDist = 0;
    let beyondSix = 0;
    let sumDist = 0;
    let reachable = 0;

    for (const b of mainCompNodes) {
      if (a === b) continue;
      const d = dist[b];
      if (d === -1) continue; // shouldn't happen in same component
      reachable++;
      sumDist += d;
      if (d > maxDist) maxDist = d;
      if (d > 6) beyondSix++;
    }

    allStats.push({
      idx: a,
      url: allUrls[a],
      name: urlToName.get(allUrls[a]) || allUrls[a],
      isCore: isCoreNode.has(a),
      eccentricity: maxDist,
      beyondSixCount: beyondSix,
      beyondSixRatio: reachable > 0 ? beyondSix / reachable : 0,
      sumDist,
      avgDist: reachable > 0 ? sumDist / reachable : 0,
    });

    processedNodes++;
  }

  process.stderr.write("\n\n");

  // === 输出结果 ===

  // 1. 按离心率排序，离心率 > 6 的节点
  const highEccNodes = allStats
    .filter((s) => s.eccentricity > 6)
    .sort((a, b) => b.eccentricity - a.eccentricity);

  console.log(`\n${"=".repeat(70)}`);
  console.log(`离心率超过 6 的节点 (共 ${highEccNodes.length} 个):`);
  console.log(`注: 离心率 = 该节点到同一分量内最远节点的距离`);
  console.log(`${"=".repeat(70)}`);

  // 按离心率分组
  const byEcc = new Map<number, NodeStats[]>();
  for (const s of highEccNodes) {
    const arr = byEcc.get(s.eccentricity) || [];
    arr.push(s);
    byEcc.set(s.eccentricity, arr);
  }

  for (const ecc of [...byEcc.keys()].sort((a, b) => b - a)) {
    const nodes = byEcc.get(ecc)!;
    console.log(`\n--- 离心率 ${ecc} 度 (${nodes.length} 个节点) ---`);
    const showNodes = nodes.slice(0, 15); // 每组最多显示 15 个
    for (const s of showNodes) {
      const core = s.isCore ? "[核心]" : "[友链]";
      console.log(
        `  ${core} ${s.name.padEnd(30)} ${s.url}  (avg=${s.avgDist.toFixed(2)}, >6=${s.beyondSixCount})`,
      );
    }
    if (nodes.length > 15) {
      console.log(`  ... 还有 ${nodes.length - 15} 个节点`);
    }
  }

  // 2. 按超六度数量排序的 TOP 节点
  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`超出六度节点对数最多的 TOP 30 节点:`);
  console.log(`${"=".repeat(70)}`);

  const byBeyondSix = allStats
    .sort((a, b) => b.beyondSixCount - a.beyondSixCount)
    .slice(0, 30);

  console.log(
    `\n  ${"排名".padEnd(4)} ${"类型".padEnd(6)} ${"名称".padEnd(30)} ${"离心率".padEnd(6)} ${">6度对数".padEnd(10)} ${">6占比".padEnd(8)} 平均距离`,
  );
  console.log(`  ${"-".repeat(85)}`);

  for (let i = 0; i < byBeyondSix.length; i++) {
    const s = byBeyondSix[i];
    const core = s.isCore ? "核心" : "友链";
    console.log(
      `  ${String(i + 1).padEnd(4)} ${core.padEnd(6)} ${s.name.slice(0, 28).padEnd(30)} ${String(s.eccentricity).padEnd(6)} ${String(s.beyondSixCount).padEnd(10)} ${(s.beyondSixRatio * 100).toFixed(1).padEnd(7)}% ${s.avgDist.toFixed(2)}`,
    );
  }

  // 3. 统计概览
  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`统计概览:`);
  console.log(`${"=".repeat(70)}`);

  const totalMainComp = mainCompNodes.length;
  const beyondSixEcc = allStats.filter((s) => s.eccentricity > 6).length;
  const coreBeyondSix = allStats.filter((s) => s.isCore && s.eccentricity > 6).length;
  const friendBeyondSix = allStats.filter((s) => !s.isCore && s.eccentricity > 6).length;

  console.log(`  主分量节点总数: ${totalMainComp}`);
  console.log(`  核心节点数: ${isCoreNode.size}`);
  console.log(`  离心率 > 6 的节点: ${beyondSixEcc} (${((beyondSixEcc / totalMainComp) * 100).toFixed(1)}%)`);
  console.log(`    其中核心节点: ${coreBeyondSix}`);
  console.log(`    其中友链节点: ${friendBeyondSix}`);

  // 小分量信息
  if (sortedComps.length > 1) {
    console.log(`\n  其他 ${sortedComps.length - 1} 个小连通分量 (节点间完全不可达):`);
    for (let i = 1; i < sortedComps.length; i++) {
      const nodes = sortedComps[i][1];
      console.log(`    分量 ${i + 1}: ${nodes.length} 个节点`);
      for (const nIdx of nodes.slice(0, 5)) {
        const url = allUrls[nIdx];
        const name = urlToName.get(url) || url;
        const core = isCoreNode.has(nIdx) ? "[核心]" : "[友链]";
        console.log(`      ${core} ${name} (${url})`);
      }
      if (nodes.length > 5) {
        console.log(`      ... 还有 ${nodes.length - 5} 个`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n总耗时: ${elapsed}s`);
}

main();
