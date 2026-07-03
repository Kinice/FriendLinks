#![deny(clippy::all)]

use napi_derive::napi;
use rayon::prelude::*;
use std::collections::VecDeque;

/// 单源 BFS 结果
#[napi(object)]
pub struct BfsOneResult {
  /// 源节点到每个节点的最短距离（-1 表示不可达）
  pub distances: Vec<i32>,
  /// 最大有限距离
  pub max_distance: u32,
}

/// 批量 BFS 结果
#[napi(object)]
pub struct BfsBatchResult {
  /// 每个源节点的 BFS 结果
  pub results: Vec<BfsOneResult>,
  /// 成功处理的源节点数
  pub processed: u32,
}

/// 从单个源节点执行 BFS，返回距离数组
#[napi]
pub fn bfs_one(
  adj: Vec<u32>,
  offsets: Vec<u32>,
  n: u32,
  source: u32,
) -> BfsOneResult {
  let n_usize = n as usize;
  let mut dist = vec![-1i32; n_usize];
  let mut q = VecDeque::with_capacity(n_usize);

  dist[source as usize] = 0;
  q.push_back(source);

  let mut max_dist = 0u32;

  while let Some(u) = q.pop_front() {
    let nd = dist[u as usize] + 1;
    let start = offsets[u as usize] as usize;
    let end = offsets[(u + 1) as usize] as usize;
    for &v in &adj[start..end] {
      let vi = v as usize;
      if dist[vi] == -1 {
        dist[vi] = nd;
        max_dist = nd as u32;
        q.push_back(v);
      }
    }
  }

  BfsOneResult {
    distances: dist,
    max_distance: max_dist,
  }
}

/// 从多个源节点并行执行 BFS
///
/// # 参数
/// * `adj` - 邻接表，所有邻居节点 ID 平铺
/// * `offsets` - 每个节点在 adj 中的起始偏移，长度为 n + 1，最后一项为 adj 的长度
/// * `n` - 总节点数
/// * `sources` - 需要执行 BFS 的源节点 ID 列表
#[napi]
pub fn bfs_batch(
  adj: Vec<u32>,
  offsets: Vec<u32>,
  n: u32,
  sources: Vec<u32>,
) -> BfsBatchResult {
  let n_usize = n as usize;
  let total = sources.len();

  // Rayon 并行 BFS，每 500 个节点一批均衡调度
  let results: Vec<BfsOneResult> = sources
    .par_chunks(500)
    .flat_map(|chunk| {
      chunk
        .iter()
        .map(|&src| bfs_one_internal(&adj, &offsets, src, n_usize))
        .collect::<Vec<_>>()
    })
    .collect();

  BfsBatchResult {
    processed: total as u32,
    results,
  }
}

/// 从所有节点并行执行 BFS（全量）
#[napi]
pub fn bfs_all(
  adj: Vec<u32>,
  offsets: Vec<u32>,
  n: u32,
) -> BfsBatchResult {
  let sources: Vec<u32> = (0..n).collect();
  bfs_batch(adj, offsets, n, sources)
}

/// 内部单源 BFS（不经过 napi 边界，减少开销）
fn bfs_one_internal(
  adj: &[u32],
  offsets: &[u32],
  source: u32,
  n: usize,
) -> BfsOneResult {
  let mut dist = vec![-1i32; n];
  let mut q = VecDeque::with_capacity(n);

  dist[source as usize] = 0;
  q.push_back(source);

  let mut max_dist = 0u32;

  while let Some(u) = q.pop_front() {
    let nd = dist[u as usize] + 1;
    let start = offsets[u as usize] as usize;
    let end = offsets[(u + 1) as usize] as usize;
    for &v in &adj[start..end] {
      let vi = v as usize;
      if dist[vi] == -1 {
        dist[vi] = nd;
        max_dist = nd as u32;
        q.push_back(v);
      }
    }
  }

  BfsOneResult {
    distances: dist,
    max_distance: max_dist,
  }
}
