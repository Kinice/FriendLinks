#!/usr/bin/env python3
"""
六度分隔理论测试脚本
读取 dist/all.json，对所有 C(n,2) 节点对计算最短路径，
统计最大距离是否超过 6 度。
"""

import json
import sys
from collections import deque
from pathlib import Path

ALL_JSON = Path(__file__).resolve().parent.parent / "dist" / "all.json"


def build_graph(sites: list[dict]) -> tuple[dict[str, int], list[str], dict[int, set[int]]]:
    """构建无向图邻接表，返回 (url→idx, idx→url, adj)"""
    # 收集所有 URL
    url_set: set[str] = set()
    for site in sites:
        url_set.add(site["url"])
        for friend in site.get("friends", []):
            url_set.add(friend["url"])

    all_urls = sorted(url_set)
    url_to_idx = {u: i for i, u in enumerate(all_urls)}

    adj: dict[int, set[int]] = {i: set() for i in range(len(all_urls))}

    for site in sites:
        src = url_to_idx[site["url"]]
        for friend in site.get("friends", []):
            dst = url_to_idx[friend["url"]]
            adj[src].add(dst)
            adj[dst].add(src)

    return url_to_idx, all_urls, adj


def bfs_distance(adj: dict[int, set[int]], start: int) -> list[int]:
    """BFS 计算 start 到所有其他节点的最短距离（边数），不可达为 -1"""
    n = len(adj)
    dist = [-1] * n
    dist[start] = 0
    q = deque([start])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if dist[v] == -1:
                dist[v] = dist[u] + 1
                q.append(v)
    return dist


def main():
    print(f"读取 {ALL_JSON} ...")
    with open(ALL_JSON, "r") as f:
        data = json.load(f)

    sites = data["sites"]
    print(f"核心节点: {len(sites)}")

    url_to_idx, all_urls, adj = build_graph(sites)
    n = len(all_urls)
    print(f"总节点数: {n}")
    print(f"总边数: {sum(len(v) for v in adj.values()) // 2}")

    max_dist = 0
    max_pair: tuple[int, int] | None = None
    dist_count: dict[int, int] = {}  # 距离 → 出现次数
    unreachable = 0
    total_pairs = 0

    # 对每个连通分量做 BFS
    # 只在同一个连通分量内比较
    component: list[int] = [-1] * n
    comp_id = 0
    comp_sizes: list[int] = []

    for i in range(n):
        if component[i] != -1:
            continue
        # BFS 标记连通分量
        q = deque([i])
        component[i] = comp_id
        comp_nodes: list[int] = []
        while q:
            u = q.popleft()
            comp_nodes.append(u)
            for v in adj[u]:
                if component[v] == -1:
                    component[v] = comp_id
                    q.append(v)

        comp_sizes.append(len(comp_nodes))
        comp_id += 1

    # 按分量大小排序，优先处理大分量
    # 重新遍历：按节点所属分量分组
    comp_nodes_map: dict[int, list[int]] = {}
    for i in range(n):
        c = component[i]
        comp_nodes_map.setdefault(c, []).append(i)

    processed_nodes = 0
    for cid in sorted(comp_nodes_map, key=lambda c: len(comp_nodes_map[c]), reverse=True):
        comp_nodes = comp_nodes_map[cid]
        size = len(comp_nodes)
        for a_idx, a in enumerate(comp_nodes):
            if a_idx % 20 == 0 or a_idx == size - 1:
                progress = (processed_nodes + a_idx + 1) / n * 100
                print(
                    f"\r  进度: {progress:.1f}%  (分量 {cid+1}/{comp_id}, 大小 {size}, 节点 {a_idx+1}/{size})",
                    end="",
                    file=sys.stderr,
                    flush=True,
                )
            dist = bfs_distance(adj, a)
            for b in comp_nodes[a_idx + 1 :]:
                d = dist[b]
                if d == -1:
                    unreachable += 1
                else:
                    total_pairs += 1
                    dist_count[d] = dist_count.get(d, 0) + 1
                    if d > max_dist:
                        max_dist = d
                        max_pair = (a, b)
        processed_nodes += size

    print("", file=sys.stderr)  # newline

    print(f"\n连通分量数: {comp_id}")
    print(f"最大分量大小: {max(comp_sizes)}")
    print(f"总可达点对数: {total_pairs}")
    print(f"不可达点对数: {unreachable}")

    print(f"\n距离分布:")
    for d in sorted(dist_count):
        bar = "█" * max(1, dist_count[d] * 60 // max(dist_count.values()))
        print(f"  {d:2d} 度: {dist_count[d]:>8d}  {bar}")

    print(f"\n最大距离: {max_dist} 度")

    if max_pair is not None:
        a_url, b_url = all_urls[max_pair[0]], all_urls[max_pair[1]]
        # 找出实际路径
        dist_a = bfs_distance(adj, max_pair[0])
        path = [max_pair[1]]
        cur = max_pair[1]
        while cur != max_pair[0]:
            for prev in adj[cur]:
                if dist_a[prev] == dist_a[cur] - 1:
                    path.append(prev)
                    cur = prev
                    break
        path.reverse()
        print(f"\n最大距离点对:")
        print(f"  起点: {a_url}")
        print(f"  终点: {b_url}")
        print(f"  路径 ({len(path)} 个节点, {len(path)-1} 条边):")
        for i, idx in enumerate(path):
            site = next((s for s in sites if s["url"] == all_urls[idx]), None)
            name = site["name"] if site else all_urls[idx]
            print(f"    {i}: {name} ({all_urls[idx]})")

    # 六度理论检验
    beyond_six = sum(v for d, v in dist_count.items() if d > 6)
    print(f"\n{'='*50}")
    print(f"六度分隔理论检验:")
    print(f"  超过 6 度的点对数: {beyond_six}")
    print(f"  总可达点对数: {total_pairs}")
    if total_pairs > 0:
        pct = beyond_six / total_pairs * 100
        print(f"  占比: {pct:.4f}%")
        if beyond_six == 0:
            print(f"  ✅ 所有可达点对都在 6 度以内，符合六度分隔理论！")
        else:
            print(f"  ❌ 有 {beyond_six} 对超过 6 度，不符合六度分隔理论")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
