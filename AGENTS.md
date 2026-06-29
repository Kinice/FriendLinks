# AGENTS

## 核心概念

`links/*.yml` 中

```yml
site:
  name: 我的博客
  description: 分享编程和技术相关的文章
  url: https://example.com
  color: "#ff6600"       # 可选，自定义节点颜色
  links: /links          # 可选，友链页面路由，如 /links /link /friends /friend 等
  friends:
    - name: 编程小站
      url: https://codehub.example.com
    - name: 技术前沿
      url: https://techfrontier.example.com
```

这里的 **yml 文件名**同时也是 `site` 的 `url`，我们叫作**核心节点**。

`friends` 里面的节点数组我们统称**友链节点**。

由于可能存在核心节点互相成为友链节点，所以在总统计时，需要排重。

## 添加友链

在 `links/{yoursite}.yml` 中填写：

```yml
site:
  name: 我的博客
  description: 分享编程和技术相关的文章
  url: https://example.com
  color: "#ff6600"
  links: /links
  friends:
    - name: 编程小站
      url: https://codehub.example.com
```

## 自定义颜色

可在 `site` 层级添加 `color` 字段指定节点颜色，值需为完整 6 位 16 进制色：

```yml
site:
  ...
  color: "#ff6600"
```

不指定则从默认 12色调色板按域名哈希分配。

## 3D 渲染规范

当前使用 `3d-force-graph` + Three.js，节点用 `MeshLambertMaterial` 球体。

| 属性 | 值 | 说明 |
|------|-----|------|
| 几何体 | `SphereGeometry` (8段) | 球体 |
| 材质 | `LambertMaterial` | 漫反射，有光照阴影 |
| 尺寸 | `degreeToSize(deg, maxDegree)` | 基于度数动态计算 |
| 颜色 | `n.color \|\| PALETTE[hashToIndex(id)]` | 自定义色或调色板 |
| 主题适配 | `adjustHex(base, 20)` | 深色模式调亮 20% |

### 交互状态颜色

| 状态 | 颜色 |
|------|------|
| 默认 | 调色板颜色（自定义或哈希） |
| 悬停 | `adjustHex(base, 40)` 调亮 40% |
| 聚焦 | `adjustHex(base, 60)` 调亮 60%，节点 1.5x |
| 高亮组内 | `adjustHex(base, 20)` 调亮 20% |
| 高亮组外 | 深色 `#2a2a2a` / 浅色 `#e0e0e0` |

### 连线渲染

| 层 | 说明 |
|----|------|
| 基础线网 | `LineSegments`，始终可见，透明度由滑块控制 |
| 叠加线网 (hover) | 白色粗管 + 荧光光晕 |
| 叠加线网 (focus) | 金色粗管 + 荧光光晕 |

## 数据端点

| 端点 | 格式 | 用途 |
|------|------|------|
| `/graph.bin` | msgpack 二进制 | 3D 图数据（客户端加载） |
| `/all.json` | JSON | 完整站点数据（外部使用） |

## 开发规范

### 包管理器

**本项目强制使用 Bun 作为唯一的包管理器。**

- 禁止使用 `npm`、`yarn`、`pnpm`
- `bun install` 安装依赖
- `bun run <script>` 运行脚本
- `bun run lint` / `bun run fmt` 代码检查与格式化

**原因**：Astro 内置 Vite 8 采用 Rolldown（Rust 编写），Bun 运行时与此架构更匹配。

### 代码风格

- 使用 `oxlint` 检查代码，`oxfmt` 自动格式化
- 提交前务必 `bun run lint && bun run fmt`

### 清理脚本

`scripts/prune-irrelevant.ts` 用于剔除友链中的无关条目。过滤规则分类在 `scripts/filter/` 下：

```bash
bun run prune
```

| 文件 | 用途 |
|------|------|
| `names.ts` | 名称关键词匹配 |
| `urls.ts` | URL 模式匹配 |
| `domains.ts` | 非博客域名列表 |
| `sensitive.ts` | 敏感域名（SHA-256 哈希） |
| `subdomains.ts` | 服务子域名前缀 |
| `platforms.ts` | 托管平台列表 |

空文件会被自动删除。
