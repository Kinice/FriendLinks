# AGENTS

## 核心概念

links/\*.yml中

```yml
site:
  name: 我的博客
  description: 分享编程和技术相关的文章
  url: https://example.com
  links: /links          # 可选，友链页面路由，如 /links /link /friends /friend 等
  friends:
    - name: 编程小站
      url: https://codehub.example.com
    - name: 技术前沿
      url: https://techfrontier.example.com
```

这里的**yml**名字同时也是`site`的`url` 我们叫作**核心节点**

`friends`里面的节点数组我们统称**友链节点**

由于可能存在核心节点互相成为友链节点，所以在总统计时，需要排重

## 添加友链

添加你的博客及其友链（建议为博客），汇聚到这个巨大的网络中吧！

在 `links/{yoursite}.yml` 中填写

格式：

```yml
site:
  name: 我的博客
  description: 分享编程和技术相关的文章
  url: https://example.com
  links: /links          # 可选，友链页面路由，如 /links /link /friends /friend 等
  friends:
    - name: 编程小站
      url: https://codehub.example.com
    - name: 技术前沿
      url: https://techfrontier.example.com
```

## 3D 节点样式规范

当前 3D 友链网络图使用 `3d-force-graph` 默认节点渲染，具体配置如下：

| 属性     | 值                             | 说明                           |
| -------- | ------------------------------ | ------------------------------ |
| 几何体   | `SphereGeometry`               | 球体，默认 8 段细分            |
| 材质     | `MeshLambertMaterial`          | Lambert 漫反射材质，有光照阴影 |
| 不透明度 | `1.0`                          | 完全不透明                     |
| 尺寸计算 | `degreeToSize(deg, maxDegree)` | 基于节点度数动态计算           |
| 颜色计算 | `PALETTE[hashToIndex(id)]`     | 基于 ID 哈希从调色板取色       |
| 主题适配 | `adjustHex(base, 20)` (dark)   | 深色主题下调亮 20%             |

### 高亮状态

| 状态     | 颜色处理                        |
| -------- | ------------------------------- |
| 默认     | 主题适配后的调色板颜色          |
| 悬停     | `adjustHex(base, 30)` 调亮 30%  |
| 聚焦     | `adjustHex(base, 50)` 调亮 50%  |
| 高亮组内 | `adjustHex(base, 30)` 调亮 30%  |
| 高亮组外 | 深色 `#2a2a2a` / 浅色 `#e0e0e0` |

**注意**：节点渲染使用 `nodeColor` + `nodeVal`，不使用自定义 `nodeThreeObject`，以保持默认的饱满立体效果。

## 开发规范

### 包管理器

**本项目强制使用 Bun 作为唯一的包管理器。**

- 禁止使用 `npm`（包括 `npm install`、`npm run` 等）
- 禁止使用 `yarn`
- 禁止使用 `pnpm`
- 统一使用 `bun` 命令：
  - `bun install` 安装依赖
  - `bun run <script>` 运行脚本
  - `bun update --latest` 更新依赖

**原因**：
- 项目已移除 `package-lock.json`，不存在 npm 锁定文件
- Astro 内置 Vite 8 采用 Rolldown（Rust 编写的 Rollup 替代），Bun 运行时与此架构更匹配
- 避免多包管理器导致的锁定文件冲突和依赖不一致

> 如果你本地没有安装 Bun，请先安装：https://bun.sh/

# currentDate
Today's date is 2026-06-28.

IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
