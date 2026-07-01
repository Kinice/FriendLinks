#!/usr/bin/env bun
/**
 * 全节点APS P六度分隔分析
 * 计算所有节点对的最短路径距离分布 C(n,2)
 *
 * 用法: bun run scripts/analyze_six_degrees.ts
 * 输出: dist/six-degrees.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSites } from "../utils/load-sites";
import { printProgress, printDone } from "../utils/progress";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, "..", "dist", "six-degrees.json");

function getHost(u: string): string {
  try { return new URL(u).hostname.toLowerCase(); } catch { return u.toLowerCase(); }
}

async function main() {
  const startTime = Date.now();
  printProgress("❶", "加载友链数据…", 0);
  const sites = await loadSites();

  // 构建完整无向图 (核心 + 外部友链节点)
  const urlSet = new Set<string>();
  const urlToName = new Map<string, string>();
  for (const s of sites) {
    urlSet.add(s.url); urlToName.set(s.url, s.name);
    for (const f of s.friends ?? []) {
      urlSet.add(f.url);
      if (!urlToName.has(f.url)) urlToName.set(f.url, f.name);
    }
  }

  const allUrls = [...urlSet];
  const n = allUrls.length;
  const urlToIdx = new Map<string, number>();
  allUrls.forEach((u, i) => urlToIdx.set(u, i));

  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const s of sites) {
    const si = urlToIdx.get(s.url)!;
    for (const f of s.friends ?? []) {
      const ti = urlToIdx.get(f.url)!;
      adj[si].push(ti); adj[ti].push(si);
    }
  }
  printProgress("❶", `图构建完成: ${n} 节点`, 20);

  // 找连通分量
  const comp = new Int32Array(n).fill(-1);
  const compSizes: number[] = [];
  let compId = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1) continue;
    const q = [i]; comp[i] = compId;
    let head = 0; let size = 0;
    while (head < q.length) {
      const u = q[head++]; size++;
      for (const v of adj[u]) {
        if (comp[v] === -1) { comp[v] = compId; q.push(v); }
      }
    }
    compSizes.push(size); compId++;
  }
  printProgress("❶", `${compId} 个连通分量`, 30);

  // 对最大分量做全节点 BFS APSP
  const mainCompId = compSizes.indexOf(Math.max(...compSizes));
  const mainNodes: number[] = [];
  for (let i = 0; i < n; i++) if (comp[i] === mainCompId) mainNodes.push(i);
  const M = mainNodes.length;

  printProgress("❷", `主分量 ${M} 节点, 开始全节点 BFS…`, 40);

  const distDist: Record<number, number> = {}; // distance → pair count
  let maxDist = 0;
  let processed = 0;

  for (let aIdx = 0; aIdx < M; aIdx++) {
    const a = mainNodes[aIdx];
    const dist = new Int32Array(n).fill(-1);
    dist[a] = 0;
    const q = [a];
    let head = 0;
    while (head < q.length) {
      const u = q[head++];
      for (const v of adj[u]) {
        if (dist[v] === -1) { dist[v] = dist[u] + 1; q.push(v); }
      }
    }
    for (const b of mainNodes) {
      if (b <= a) continue; // 只统计 a<b, 即 C(M,2) 对
      if (dist[b] === -1) continue;
      const d = dist[b];
      if (d > maxDist) maxDist = d;
      distDist[d] = (distDist[d] || 0) + 1;
    }
    processed++;
    if (processed % 500 === 0) {
      const pct = 40 + Math.round((processed / M) * 50);
      printProgress("❷", `BFS ${processed}/${M}`, pct);
    }
  }
  printProgress("❷", `BFS 完成: ${M} 节点 × ${M} 次`, 90);

  // 中间顶点数分布
  const intermediateDist: Record<number, number> = {};
  for (const [d, cnt] of Object.entries(distDist)) {
    const iv = Number(d) - 1;
    intermediateDist[iv] = (intermediateDist[iv] || 0) + cnt;
  }

  const result = {
    totalNodes: n,
    mainComponentSize: M,
    otherComponents: compSizes.filter((_, i) => i !== mainCompId),
    totalComponentCount: compId,
    maxEdgeDistance: maxDist,
    maxIntermediateVertices: maxDist - 1,
    edgeDistanceDistribution: distDist,
    intermediateVertexDistribution: intermediateDist,
    totalPairs: mainNodes.length * (mainNodes.length - 1) / 2,
    buildTime: ((Date.now() - startTime) / 1000).toFixed(1) + "s",
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
  printDone(`/six-degrees.json  主分量 ${M} 节点, 耗时 ${result.buildTime}`);
}

main();
