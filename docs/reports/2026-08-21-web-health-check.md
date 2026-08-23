# 全站网页打开与流畅度健康检查

> 检查目标：所有网页能否正常打开且运行流畅（结构层 / 加载层 / 运行层 / 端到端）
> 检查日期：2026-08-21
> 环境：纯静态前端（HTML/CSS/JS + Service Worker），沙箱无无头浏览器

## 结论：**通过 ✅**（资源完整、脚本无错、端到端管线全绿）

---

## 1. 静态完整性（能否打开，不 404）
| 维度 | 结果 |
|---|---|
| HTML 页面总数 | 413 |
| 本地引用（script/link/img） | 2,654 条 |
| 缺失引用（会 404 的死链） | **0** |

所有页面引用的 JS/CSS/图片资源在磁盘上均真实存在。

## 2. JS 语法（是否解析即崩）
- 99 个 JS 文件全部通过 `node --check`，**0 语法错误**。

## 3. 加载期崩溃（库/插件加载即报错）
- 用浏览器全局 shim 在 Node 中执行：6 个共享库（common/print/knowledge-bank/module-catalog/registry/pinyin-bank）+ 73 个插件。
- 结果：**0 运行时异常**，`App`、`PluginUtil` 均正常初始化。

## 4. 插件发现机制（页面能否找到题型）
- `window.PLUGIN_REGISTRY`：69 条，id 全唯一，注册文件全部存在，覆盖 1–6 年级。
- `practice.html` 依赖该注册表 → 发现链路完好。

## 5. 端到端管线（生成→渲染→批改是否真的可用）
| 项目自带校验 | 结果 |
|---|---|
| `dev/regression-check.js` | **118/118** 插件·年级组合满分 |
| `dev/verify-competition.js` | 8 竞赛插件 / 132 组抽样全绿 |
| `dev/verify-knowledge-bank.js --g4 --g5 --g6` | 通过（仅 C9 仍占位，属 #50 计划内） |

## 6. 限制与说明
- **未做像素级渲染测量**：当前沙箱无 Chromium/Playwright/Puppeteer，无法实测视觉布局与帧率。但资源、语法、加载、逻辑四层均已验证，打开与基本流畅度风险极低。
- **唯一非零项**：`dev/verify-setup.js` 报 `_template.js 包含 plugin 对象` —— 这是样板文件约定 lint（模板不应含具体 plugin 对象），非页面故障，本次未改动。
- **C9 竞赛综合** 仍为占位插件（KB 警告），属 Task #50 计划，不影响现有页面运行。

## 建议（如需进一步验证视觉流畅度）
在本地用浏览器打开后，可用 DevTools 的 Lighthouse / Performance 面板实测首屏与交互流畅度；或安装 Playwright 后我可补做无头渲染 + 控制台报错采集。
