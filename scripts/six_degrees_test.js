#!/usr/bin/env bun
/**
 * 六度分隔理论测试脚本 (JavaScript)
 * 读取 dist/all.json，对所有 C(n,2) 节点对计算最短路径，
 * 统计最大距离是否超过 6 度。
 *
 * 用法: bun scripts/six_degrees_test.js
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALL_JSON = resolve(__dirname, "..", "dist", "all.json");

/** BFS 计算 start 到所有其他节点的最短距离（边数），不可达为 -1 */
function bfsDistance(adj, start) {
  const n = adj.length;
  const dist = new Int32Array(n).fill(-1);
  dist[start] = 0;
  const q = [start];
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

/** 构建无向图邻接表，返回 { urlToIdx, allUrls, adj } */
function buildGraph(sites) {
  const urlSet = new Set();
  for (const site of sites) {
    urlSet.add(site.url);
    for (const friend of site.friends || []) {
      urlSet.add(friend.url);
    }
  }

  const allUrls = [...urlSet].sort();
  const urlToIdx = new Map();
  allUrls.forEach((u, i) => urlToIdx.set(u, i));

  const n = allUrls.length;
  const adj = Array.from({ length: n }, () => []);
  for (const site of sites) {
    const src = urlToIdx.get(site.url);
    for (const friend of site.friends || []) {
      const dst = urlToIdx.get(friend.url);
      adj[src].push(dst);
      adj[dst].push(src);
    }
  }

  return { urlToIdx, allUrls, adj };
}

function main() {
  console.error(`读取 ${ALL_JSON} ...`);
  const raw = readFileSync(ALL_JSON, "utf-8");
  const data = JSON.parse(raw);

  const sites = data.sites;
  console.error(`核心节点: ${sites.length}`);

  const { allUrls, adj } = buildGraph(sites);
  const n = allUrls.length;
  const edgeCount = adj.reduce((sum, a) => sum + a.length, 0) / 2;
  console.error(`总节点数: ${n}`);
  console.error(`总边数: ${edgeCount}`);

  // 找连通分量
  const component = new Int32Array(n).fill(-1);
  const compNodesMap = new Map(); // compId -> [nodeIdx...]
  let compId = 0;

  for (let i = 0; i < n; i++) {
    if (component[i] !== -1) continue;
    const q = [i];
    component[i] = compId;
    const nodes = [];
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

  // 按大小排序，优先大分量
  const sortedComps = [...compNodesMap.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  let maxDist = 0;
  let maxPair = null;
  const distCount = {};
  let unreachable = 0;
  let totalPairs = 0;
  let processedNodes = 0;

  const startTime = Date.now();

  for (const [cid, compNodes] of sortedComps) {
    const size = compNodes.length;
    for (let aIdx = 0; aIdx < size; aIdx++) {
      if (aIdx % 50 === 0 || aIdx === size - 1) {
        const progress = ((processedNodes + aIdx + 1) / n) * 100;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stderr.write(
          `\r  进度: ${progress.toFixed(1)}%  (分量 ${cid + 1}/${compId}, 大小 ${size}, 节点 ${aIdx + 1}/${size})  ${elapsed}s`,
        );
      }

      const a = compNodes[aIdx];
      const dist = bfsDistance(adj, a);

      for (let bIdx = aIdx + 1; bIdx < size; bIdx++) {
        const b = compNodes[bIdx];
        const d = dist[b];
        if (d === -1) {
          unreachable++;
        } else {
          totalPairs++;
          distCount[d] = (distCount[d] || 0) + 1;
          if (d > maxDist) {
            maxDist = d;
            maxPair = [a, b];
          }
        }
      }
    }
    processedNodes += size;
  }

  process.stderr.write("\n\n");

  console.log(`\n距离分布:`);
  const maxCount = Math.max(...Object.values(distCount));
  for (const d of Object.keys(distCount)
    .map(Number)
    .sort((a, b) => a - b)) {
    const bar = "█".repeat(
      Math.max(1, Math.round((distCount[d] * 60) / maxCount)),
    );
    console.log(
      `  ${String(d).padStart(2)} 度: ${String(distCount[d]).padStart(8)}  ${bar}`,
    );
  }

  console.log(`\n最大距离: ${maxDist} 度`);
  if (maxPair) {
    // 回溯路径
    const [aIdx, bIdx] = maxPair;
    const distA = bfsDistance(adj, aIdx);
    const path = [bIdx];
    let cur = bIdx;
    while (cur !== aIdx) {
      for (const prev of adj[cur]) {
        if (distA[prev] === distA[cur] - 1) {
          path.push(prev);
          cur = prev;
          break;
        }
      }
    }
    path.reverse();
    console.log(`\n最大距离点对:`);
    console.log(`  起点: ${allUrls[path[0]]}`);
    console.log(`  终点: ${allUrls[path[path.length - 1]]}`);
    console.log(`  路径 (${path.length} 个节点, ${path.length - 1} 条边):`);
    for (let i = 0; i < path.length; i++) {
      const url = allUrls[path[i]];
      const site = sites.find((s) => s.url === url);
      const name = site ? site.name : url;
      console.log(`    ${i}: ${name} (${url})`);
    }
  }

  const beyondSix = Object.entries(distCount)
    .filter(([d]) => Number(d) > 6)
    .reduce((sum, [, v]) => sum + v, 0);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`六度分隔理论检验:`);
  console.log(`  超过 6 度的点对数: ${beyondSix}`);
  console.log(`  总可达点对数: ${totalPairs}`);
  if (totalPairs > 0) {
    const pct = (beyondSix / totalPairs) * 100;
    console.log(`  占比: ${pct.toFixed(4)}%`);
    if (beyondSix === 0) {
      console.log(`  ✅ 所有可达点对都在 6 度以内，符合六度分隔理论！`);
    } else {
      console.log(`  ❌ 有 ${beyondSix} 对超过 6 度，不符合六度分隔理论`);
    }
  }
  console.log(`${"=".repeat(50)}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n总耗时: ${elapsed}s`);
}

main();
