# Workite 单页官网

原生 HTML、CSS、JavaScript，无构建步骤、外部字体或第三方运行时。页面资源使用相对路径，可以直接打开 `index.html`，也支持 GitHub Pages 的项目子路径。

## 本地预览

在仓库根目录运行：

```bash
python3 -m http.server 4173 --directory website
```

访问 <http://localhost:4173>。复制按钮在安全上下文中使用 Clipboard API；不可用时选中当前代码，提示使用键盘复制。

## GitHub Pages

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 将 `website/` 与 `.github/workflows/pages.yml` 合入 `main`，或在 Actions 中手动运行 **Publish Workite website**。
3. 工作流只上传 `website/`，通过 GitHub 官方 Pages Actions 发布，地址以部署输出的 `page_url` 为准。

默认项目地址为 <https://workite-io.github.io/workite/>。如需绑定 `workite.io`，在 Pages 设置中配置 Custom domain，完成 DNS 配置后启用 HTTPS。当前未添加 `CNAME`。

## 页面与交互

- 首屏：PD、Gateway、Broker、Worker 四个等规格的圆形组件节点共同形成 Workite 的风筝轮廓，中央保留完整、正向的品牌标识与橙色 Leader 节点。四类组件均可由多个实例组成，因此图标底盘保持一致，不对单独角色增加节点叠影。组件名称与职责是可随字号排版的 HTML 文本，流光表达持续协作。首屏侧重品牌与分布式角色，不画具体通信箭头、API 链路、集群框或状态转移；真实通信关系由下方架构演示说明。
- 架构：无状态 Gateway 池、PD 单 Raft Group、Broker Multi-Raft 集群。Client 与 Workers 同尺寸，控制面与数据面同高，Broker 节点位于虚线集群框内。Worker 仅连接 Gateway 与 PD。连线依据实际组件边界计算，圆滑转角；箭头独立绘制，尖端与边框留出 6px，线身止于箭头底部。竖线与“注册 / 续约”“Leader 路由”标签相距 24px。
- 演示：流程执行、故障恢复、水平扩展三种场景。进入视口、切换场景自动播放，四步循环。显式暂停或手动逐步浏览的选择在切换场景、离开视口后保留；点击播放恢复。页面隐藏、离开视口或全局暂停时停止播放。
- 状态：当前步骤使用蓝色节点与亮青色连线；Leader 同时有文字标识，离线 Broker 同时用红色与“离线”文字。P1 故障演示包含暂时没有 Leader 的阶段，选主后路由转向 Broker 2。Gateway 到 Broker 集群的入口连线与“Leader 路由”标签保持固定，实际 Leader 变化通过分区角色与节点高亮说明。扩容演示先注册为 Learner、追赶日志，再按变更计划晋升。
- 扩容节点：Broker 4 与上方三个 Broker 整排的左右边界对齐。追赶与就绪阶段通过文字和高亮说明，不添加指向 Broker 4 的独立连线或箭头。
- 内容：持久执行、分区复制、BPMN 流程示意、Service Task 创建 Job 的生命周期、现有 Grafana 集成、构建 / Go SDK / wkctl 示例、当前开发范围与社区许可。

架构是说明性模型，三副本只是示例。恢复以 Raft 多数派可用为前提。新节点迁移期间的额外副本不代表永久增加副本因子。页面不使用未经验证的性能数字或 exactly-once 承诺。

## 设计依据

使用 `apple-design` skill 中适用于 Web 的布局、可访问性、色彩、品牌与动效原则。

- `layout.md › Visual hierarchy`：“Group related items to clearly express related information or functions.” 内容按可靠性、协作架构、业务执行与开发入口分组。
- `branding.md › Best practices`：“Ensure branding always defers to content.” 四个组件共同形成品牌轮廓，品牌标识与分布式角色属于同一个构图。
- `design-principles.md › Simplicity`：“Simplicity isn’t minimalism.” 首屏保留理解分布式产品必需的四个组件名称与职责。
- `icons.md › Best practices`：“Maintain visual consistency across all interface icons in your app.” 四个组件图标统一尺寸、线宽、底盘与文字规格。
- `motion.md › Best practices`：“Make motion optional.” 全局暂停、演示暂停、逐步浏览与系统减少动态效果均可使用。
- `dark-mode.md › Best practices`：“Ensure that your app looks good in both appearance modes.” 深色跟随系统，无独立主题切换。
- `buttons.md › Best practices`：“a button needs a hit region of at least 44x44 pt”。导航与主要交互保留至少 44px 的点击区域。

### 视觉 Tokens

| 角色 | 浅色 | 深色 | 对背景的对比度 |
| --- | --- | --- | --- |
| 页面背景 | `#FFFFFF` | `#0B1220` | — |
| 辅助背景 | `#F5F7FB` | `#131F32` | — |
| 正文 | `#0B1220` | `#EDF2FF` | 18.72:1 / 16.71:1 |
| 次级正文 | `#475569` | `#A5B3CD` | 7.58:1 / 8.85:1 |
| 链接 / 选中 | `#2563EB` | `#93C5FD` | 5.17:1 / 10.38:1 |
| Leader 品牌节点 | `#F59E0B` | `#F59E0B` | 图形色，非正文色 |

蓝色主按钮使用 `#2563EB` 配白字，对比度 5.17:1。正文使用系统无衬线字体，约 16px；显示标题采用更大的字号与较紧字距；代码使用 SF Mono / Consolas / Menlo。首屏组件说明采用 HTML 文本，窄屏名称与职责保留至少约 12px，品牌原图不旋转或透视拉伸。

常规宽度采用“文案 + 分布式协作风筝 / 架构演示 / 文案 + 执行说明 / 开发入口”的层级；窄屏变为单列。完整架构保留可读图幅，允许局部横向浏览，下方步骤说明始终按屏幕宽度排版。首屏采用短暂的入场与协作流光，支持全局暂停与系统减少动态效果；静态状态保留全部组件与品牌。

支持键盘焦点、Tab 的左右箭头及 Home / End、跳转到内容、`prefers-reduced-motion`、`prefers-reduced-transparency` 与 `prefers-contrast`。自动演示不连续播报屏幕阅读器消息，手动浏览恢复播报。减少动态效果时改为静态逐步操作；没有 JavaScript 也能阅读正文与默认架构。

## 内容来源

- `.github/profile/README.md`、`README.md`、`README.zh-CN.md`：产品定位、当前开发范围与许可。
- `workite/README.md`、`workite/workite-brand.md`、`workite/icon/`：品牌、配色与标识。
- `docs/assets/workite-technical-architecture.zh-CN.svg`：通信关系、控制面与数据面划分。
- `clients/go/README.md`：Go SDK、Worker 与 wkctl 的当前接口及配置。
- `docs/metrics.md` 与 `monitor/grafana/`：监控入口。

维护时请同步核对架构 SVG、当前协议与客户端文档。品牌图案与技术架构的页面副本位于 `website/assets/`。
