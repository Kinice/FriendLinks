# Dist 产物分析 & CDN 优化方案（修订版）

## 一、当前 Dist 产物概览（总大小 ~20 MB）

```
dist/                                          大小     说明
├── all.json                             7.1 MB  对外接口，客户端不调用 → 保留
├── graph-core.bin                       2.2 MB  zstd 压缩
├── graph-bezier.bin                     5.6 MB  zstd 压缩
├── _astro/
│   ├── graph3d.BcgUN5Or.js             914 KB  Three.js + FlexSearch + 应用逻辑
│   ├── zstd.CV7N7xSg.wasm              246 KB
│   ├── index.astro_...js                6.9 KB
│   ├── Dialog.astro_...js               5.2 KB
│   ├── index.Ctnrp7wA.css               48 KB
│   └── __vite-browser-external.js        61 B
├── scripts/
│   └── index-client.js                 3.2 MB  ⚠️ 孤立文件，无任何引用！
├── index.html                           40 KB
└── stats.json                           6.4 KB
```

## 二、发现的关键问题

### 🔴 问题 1：孤立文件 `public/scripts/index-client.js`（3.2 MB）
- 位于 `public/scripts/`，Astro 构建时原样复制到 `dist/`
- **页面实际引用的是 Astro 打包后的 `_astro/graph3d.BcgUN5Or.js`（914 KB）**
- 旧版预打包产物，未被任何 HTML/JS 引用
- **CDN 影响**：浪费 3.2 MB 带宽 + 缓存空间

### 🔴 问题 2：无代码分割，vendor 与应用代码混在一起
- `graph3d.BcgUN5Or.js`（914 KB）将 Three.js、FlexSearch 和应用代码打包在一起
- 应用代码更新时，用户需重新下载 914 KB 完整包
- **CDN 影响**：vendor 无法独立缓存，版本迭代效率低

### 🔴 问题 3：无 CDN 缓存策略与资源提示
- 未配置 preload/preconnect 资源提示
- 未预压缩静态资源（gzip/brotli）

### 🔴 问题 4：zstd.wasm 与 graph bundle 捆绑加载
- 246 KB WASM 在入口脚本加载时即获取，即使 graph data 可能是未压缩的

## 三、优化方案

### 优化 1：删除孤立文件 🎯 立即见效，节省 3.2 MB
- 删除 `public/scripts/index-client.js`
- 该文件在 `public/` 目录下，不会被 Astro 处理，只是原样复制

### 优化 2：代码分割 🎯 提升缓存效率
在 `astro.config.mjs` 的 `vite.build.rollupOptions.output` 中添加 `manualChunks`：
```js
manualChunks: {
  'vendor-three': ['three'],
  'vendor-flexsearch': ['flexsearch'],
  'vendor-msgpackr': ['msgpackr'],
}
```
将 Three.js (~600 KB)、FlexSearch (~150 KB)、msgpackr 拆分为独立 vendor chunk，应用代码更新时 vendor 长期命中 CDN 缓存。

### 优化 3：资源预加载提示 🎯 加速关键资源
在 `index.astro` 的 `<head>` 中添加：
- `<link rel="preload" href="/graph-core.bin" as="fetch" crossorigin />` — 高优预加载核心图数据
- `<link rel="preconnect" href="https://你的CDN域名" />` — 预连接 CDN

### 优化 4：构建后预压缩静态资源 🎯 减少传输体积 60-70%
在构建脚本中增加一步，对 `.js`、`.css`、`.html` 文件进行 gzip 预压缩：
```json
"postbuild": "bun run scripts/compress-static.ts"
```
生成 `.gz` 文件，支持 CDN 直接 serve pre-compressed 内容。JS/CSS/HTML 通常可压缩 60-70%。

### 优化 5：延迟加载 zstd.wasm 🎯 减少首屏关键路径
将 `@bokuweb/zstd-wasm` 改为动态 import，仅在检测到 graph 文件头为 zstd magic bytes 时才加载：
```ts
// 原：import { init, decompress } from "@bokuweb/zstd-wasm";
// 改：
const zstd = await import("@bokuweb/zstd-wasm");
await zstd.init();
```
避免 246 KB WASM 在入口 bundle 中同步阻塞。

### 优化 6：客户端计算贝塞尔曲线 🎯 节省 5.6 MB 下载（可选）
当前 `graph-bezier.bin`（5.6 MB）存储预计算的贝塞尔控制点。节点坐标已在 `graph-core.bin` 中，可在客户端即时计算曲线：
- **收益**：省去 5.6 MB 下载，减少一次 fetch 请求
- **代价**：增加 ~2ms/边的 CPU 计算
- 适合网络较慢但设备较强的场景

## 四、预期效果

| 优化项 | 节省 | 实施难度 |
|--------|:---:|:-------:|
| ① 删除孤立文件 | **-3.2 MB** | ⭐ 极低 |
| ② 代码分割 | 缓存复用 | ⭐⭐ 低 |
| ③ 资源预加载 | 减少 waterfall | ⭐ 极低 |
| ④ 预压缩静态资源 | **-60~70%** JS/CSS/HTML | ⭐⭐ 低 |
| ⑤ 延迟加载 zstd.wasm | 减少首屏阻塞 | ⭐⭐ 低 |
| ⑥ 客户端贝塞尔 | **-5.6 MB**（可选） | ⭐⭐⭐ 中 |

## 五、实施顺序

1. **删除孤立文件** — 改一行删除
2. **预压缩 + 资源提示** — 加脚本和 meta tag
3. **代码分割** — 改 astro.config
4. **延迟加载 zstd.wasm** — 改 graph3d/index.ts
5. **客户端贝塞尔** — 需在 build-graph.ts 和 graph3d 中调整