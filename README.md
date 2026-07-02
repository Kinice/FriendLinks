# 博客宇宙

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/xingwangzhe/FriendLinks)

> 探索浩瀚的博客宇宙，寻找彼此之间的联系。每个节点是一个博客，每条连线是一段友链关系。

**法律合规说明：** 网站所有者和投稿者必须确保其发布内容及网站运营遵守中华人民共和国以及适用情况下的美利坚合众国法律法规。

**请确保：** 你的站点使用 `https` 并可以在中国大陆访问。

---

## 快速添加你的博客

在 `links/{你的域名}.yml` 中填写：

```yaml
site:
  name: 我的博客
  description: 分享编程和技术相关的文章
  url: https://example.com
  color: "#ff6600"       # 可选，自定义节点颜色（16 进制）
  links: /links          # 友链页面路由（必填）
  friends:
    - name: 编程小站
      url: https://codehub.example.com
```

提交 PR 即可。

> **友链页面路由**常见值：`/links`、`/link`、`/friends`、`/friend`、`/links.html` 等。

---

## 3D 网络图特性

- **3D 球状布局**：节点围绕球体分布，鼠标拖拽旋转、滚轮缩放
- **自适应主题**：自动跟随系统明暗模式，也可手动切换
- **搜索**：模糊搜索站点名或域名
- **聚焦**：右键节点 → 相机拉近、放大高亮、金色粗管荧光连线
- **悬停**：显示站点名称、描述、链接，白色荧光连线
- **连线透明度**：可调滑块控制基础线网透明度
- **自定义颜色**：YAML 中指定 `color: "#ff6600"` 即可覆盖默认调色板

### 交互方式

| 操作 | 效果 |
|------|------|
| 左键点击节点 | 在新标签页打开网站 |
| 右键点击节点 | 聚焦该节点（相机拉近、金色粗管荧光连线） |
| 悬停节点 | 显示信息浮层 + 白色荧光连线 |
| 拖拽 | 旋转 3D 视角 |
| 滚轮 | 缩放 |
| 顶部搜索框 | 模糊搜索 |
| 「连线设置」按钮 | 调整基础线网透明度（默认全透明） |
| URL `?local=域名` | 自动聚焦指定节点 |

---

## 数据格式

### 图数据端点

| 端点 | 格式 | 说明 |
|------|------|------|
| `/graph.bin` | msgpack 二进制 | 客户端加载，紧凑高效 |
| `/all.json` | JSON | 完整站点数据（外部使用） |

### YAML → 图数据流程

```
links/*.yml  →  load-sites.ts（校验） →  graph.bin.ts（力导布局+msgpack编码） →  /graph.bin
                                                                             →  3D 渲染
```

---

## 本地开发

项目使用 **Bun** 管理依赖：

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 构建生产版本
bun run build

# 代码检查与格式化
bun run lint
bun run fmt
```

### 项目结构

```
src/
├── pages/
│   ├── graph.bin.ts      # msgpack 图数据端点（核心）
│   ├── all.json.ts        # 完整站点数据端点
│   ├── stats.json.ts      # 统计端点
│   └── index.astro        # 主页面
├── scripts/
│   ├── graph3d/           # 3D 渲染模块
│   │   ├── index.ts       # 初始化、交互、API
│   │   └── utils.ts       # 调色板、颜色工具
│   ├── index-client.ts    # 客户端入口
│   ├── filter.ts          # 过滤入口（导入以下子模块）
│   ├── filter/
│   │   ├── names.ts       # 名称关键词模式
│   │   ├── urls.ts        # URL 正则模式
│   │   ├── domains.ts     # 非博客域名列表
│   │   ├── sensitive.ts   # 敏感域名（SHA-256 哈希）
│   │   ├── subdomains.ts  # 服务子域名前缀
│   │   └── platforms.ts   # 托管平台列表
│   └── prune-irrelevant.ts  # 友链无关条目剔除
├── utils/
│   └── load-sites.ts      # YAML 读取/校验
├── css/                   # 样式文件
links/                     # 友链 YAML 源文件（核心数据）
scripts/
  ├── prune-irrelevant.ts  # 清理脚本
  ├── check-access.ts      # 可达性检查
types/                     # TypeScript 类型定义
```

### 剔除无关条目

爬虫可能抓入非友链数据（备案号、主题框架、社交链接、站内页面等）。运行清理脚本：

```bash
bun run prune
```

过滤规则按类别拆分在 `scripts/filter/` 目录下：

| 文件 | 用途 |
|------|------|
| `names.ts` | 名称关键词匹配（如「备案」「教程」「商城」） |
| `urls.ts` | URL 模式匹配（如 `beian.`、图片文件后缀） |
| `domains.ts` | 非博客域名列表（如 `github.com`、社交平台） |
| `sensitive.ts` | 敏感域名（SHA-256 哈希，避免明文出现在 git） |
| `subdomains.ts` | 服务子域名前缀（如 `cdn.`、`api.`、`img.`） |
| `platforms.ts` | 托管平台列表（不向上匹配父域名） |

脚本会自动剔除无关条目，友链全空时自动删除文件。

### 六度分隔理论验证

基于构建好的 `dist/all.json` 数据，对所有 C(n,2) 节点对计算最短路径，检验友链网络是否符合「六度分隔理论」(任意两个节点之间最多经过 6 条边即可连通)。

```bash
# Python 版本
python3 scripts/six_degrees_test.py

# JavaScript 版本 (Bun)
bun scripts/six_degrees_test.js

# TypeScript 版本 (Bun)
bun scripts/six_degrees_test.ts
```

输出包括距离分布直方图、最大距离点对路径、以及是否突破 6 度。

---

## 调色板

默认 12 色，节点颜色由其域名哈希决定。可在 YAML 中通过 `color` 字段自定义。

```
#E69F00  #56B4E9  #009E73  #0072B2
#D55E00  #CC79A7  #8C564B  #E377C2
#7F7F7F  #17BECF  #4E79A7  #B1C94E
```
