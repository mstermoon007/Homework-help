# P28-Legacy-Isolation — KBL 历史数据隔离审计

| 项 | 值 |
|---|---|
| 任务 | P28-06 KBL 历史数据隔离（598/566/564/1293/639 / 旧 KP ID / 旧知识层 / legacy-knowledge 全库清扫） |
| 执行日期 | 2026-09-20 |
| 范围 | 全库 750+ 文件（排除 node_modules/.git/dev-reports/二进制） |
| 判定规则 | 当前生产代码（shared/ tools/ plugins/ 页面/ scripts/ .github/）= **0 命中**；当前文档区分历史口径；历史文档与 archive 保留。 |

## 1. 审计 Token 定义

| Token | 含义 | 判定 |
|---|---|---|
| `598` `566` `564` `1293` `639` | 旧数据集计数（旧 598 KP / legacy 基线 566 / 旧 relations 1293/1287 / 旧契约 639） | 生产代码必为 0 |
| `KnowledgeBank` | 旧知识库系统名（含旧全局 `KnowledgeBank`、旧全局 `KnowledgeBankCompat`） | 生产代码必为 0 |
| `legacy knowledge` | 旧知识引用措辞 | 生产代码必为 0 |
| `legacy id` | 旧模块制 / 竞赛制 ID 措辞 | 生产代码必为 0 |
| 旧 KP ID 文本形态 `math-gN-c*-*` | 竞赛/模块制旧 ID | 生产代码必为 0 |
| `oldUnitId` | canonical 溯源字段名 | 仅 canonical/工具保留（非旧数据引用，见 §4.7） |
| 现行 ID `math-gN-up/down-uNN-kNNN` | 现行 375 集 ID（文本形态与旧 ID 一致） | **误报**（差异在 ID 集合，非格式），不计入 |

> 注：旧 KP ID 与现行 KP ID 文本格式一致（`math-gN-…`），无法以格式区分；真实隔离差异为 **ID 集合/计数**（598 旧集 vs 375 现行）。故文本形态类命中按「现行 ID」计为误报，仅记录计数特征。

## 2. 分类矩阵（复扫后，排除二进制）

| 类别 | 598/566/564/1293/639 | KnowledgeBank | legacy-knowledge | legacy-id | 处置 |
|---|---|---|---|---|---|
| **当前生产代码**（shared/tools/plugins/页面/scripts） | **0** | **0** | **0** | **0** | ✅ 达到冻结目标 |
| 当前文档（docs/ 非 archive） | 3×3 冻结文档（历史事实） | 4（冻结文档历史叙述） | 0 | 1（P25 审计文档） | 保留为冻结历史口径（§4.3） |
| dev 工具/门禁/历史报告（dev/） | 历史报告 18 | 7（唯一性门禁 watchdog）+ 历史报告 | 状态串 | 0 | 门禁 watchdog 保留（§4.4）；历史报告保留 |
| 测试（tests/） | 0 | 0 | 0 | 0 | ✅ |
| kbl/ 数据/清单 | 1（source-manifest 溯源注记） | 0 | 0 | 0 | 保留为溯源记录（§4.6） |
| migration/ 档案 | 有（历史基线） | 2 | 0 | 0 | 保留为历史归档 |
| archive/ + docs/archive | 有（历史文档与工具） | 有 | 有 | 有 | 保留为历史归档（§4.5） |
| 其他（根级静态页/清单） | 1（根 README P20 历史口径） | 0 | 0 | 0 | 保留为历史时点语句（§4.7） |

## 3. 整改明细（本任务已执行）

### 3.1 兼容桥全局改名（行为保持，纯接线符号）
`KnowledgeBankCompat` → `KnowledgeCompat`
- `shared/engine/knowledge-compat.js`（定义/导出/头注释映射行）
- `dev/build-strategy-bundle.js`（SHIMS：`'shared/knowledge/knowledge-bank.js': 'KnowledgeCompat'`）
- `dev/check-kbl-uniqueness.js`（监视键/插桩目标改名）
- 重建 `shared/engine/strategy-engine.bundle.js`（`npm run build:strategy`，modules 67 / shims 7）

> 保留模块键 `shared/knowledge/knowledge-bank.js`（冻结 Strategy require 标识，浏览器经 SHIMS 委托回 KBL Runtime；Node 下为 13 个 `FROZEN_LEGACY_ACCESS` 受控引用）。删除它需要改写冻结 Strategy 依赖键，远超隔离目标且易引入回归——按体系判定为**结构性接线，保留并登记**。

### 3.2 死分支清理
- `shared/strategy/comprehensive-strategy.js` `getKB()`：删除永假的 `global.KnowledgeBank` 分支；依赖缺失消息改为 `shared/engine/knowledge-compat.js`。

### 3.3 生产代码注释去旧词（7 处）
- `shared/capacity/capacity-inventory.js:5`
- `shared/generator/generator-registry.js:276`
- `shared/orchestration/practice-plan.js:5`
- `shared/orchestration/budget-allocation.js:4`
- `shared/orchestration/practice-orchestrator.js`（×2）
- `shared/generation/api.js:603`

### 3.4 历史删除注记措辞重写（17 处 generator 头注）
`竞赛制/模块制 legacy ID` → `历史 ID`（P25-06 竞赛 KP 剔除注记，含义不变）：
application / c1-number-puzzle / c2-number-theory / c9-comprehensive / classify / complex / composite / counting / money / picture-equation / position / reasoning / semantic-special ×2 / shape / stats；并重写 c5-c6、c7 两个 recognize 注记（去除已删除旧 KP 明文 ID）。

### 3.5 共享知识层 README 数据核真重写
`shared/knowledge/README.md`：598/639/128 单元等陈旧数字 → 375 KP / 98 单元 / 0 关系 / 1570 契约 / rootHash 锁定；更新构建链（extract-source/derive-kbl/emit-canonical + `npm run verify`）；兼容桥说明改指 `KnowledgeCompat`。

### 3.6 dev 工具陈旧计数修正
- `dev/scan-capacity.js`：`566 KP` → `375 KP`
- `dev/build-knowledge-pages.js`：旧知识层 / 历史 ID 措辞

### 3.7 门禁收紧
`dev/check-kbl-uniqueness.js`：`legacy-bank` 模式 `/\bKnowledgeBank\b(?!Compat)/` → `/\bKnowledgeBank\b/`（取消兼容桥豁免，未来任何 KnowledgeBank 出现即违规）。

## 4. 保留项与理由

| # | 保留项 | 类别 | 理由 |
|---|---|---|---|
| 4.1 | `shared/engine/knowledge-compat.js` 桥 + bundle 模块键 | 结构性接线 | 冻结 Strategy require 标识 → Runtime 委托；改名已除旧词，行为保持 |
| 4.2 | 13 个 `FROZEN_LEGACY_ACCESS` 文件对旧模块路径的 require | 结构性接线 | 冻结模块依赖键；唯一性门禁 PM2 已登记并监控 |
| 4.3 | `docs/00-PROJECT-BASELINE.md` `docs/01-ARCHITECTURE-FROZEN.md` `docs/02-DEVELOPMENT-TIMELINE.md` 中的 598/639/1293 与旧层描述 | 冻结文档历史口径 | P28-02 冻结文档；这些数字系历史事实记录，改数字即篡改冻结档案 |
| 4.4 | `dev/check-kbl-uniqueness.js` 的 `KnowledgeBank` 模式/键/状态标签 | 门禁 watchdog | 其功能即「检测旧词再出现」，词出现于检测器自证语义；动态标签验证旧全局保持 `undefined` |
| 4.5 | `archive/` `docs/archive/` `migration/archive/` 全部命中 | 历史归档 | 隔离目标即归档不改造 |
| 4.6 | `kbl/manifest/source-manifest.json` 598 注记；canonical `relations.json` 1287 注记 | 溯源记录 | 记录源文件替换裁决，属不可变清单 |
| 4.7 | 根 `README.md` P20「598 KP 覆盖」；根 `knowledge/` 静态页与 sitemap 中的现行 ID 形态 | 历史时点语句 / 当前数据误报 | P20 里程碑当时口径不可改写；静态页均为现行 375 集 ID |
| 4.8 | `oldUnitId`（`tools/kbl/build.js` 注释与剥离、README 注记、`migration/excel-raw/units.json`） | canonical 溯源字段 | 仅存在于数据源与剥离逻辑，未进入产物/bundle；非旧数据引用 |
| 4.9 | `dev/reports/*`、`dev/p2*/reports/*` 历史报告命中 | 历史报告 | 时点快照产物，按治理惯例不改写 |

## 5. 验证结果（2026-09-20 执行）

| 门禁 | 结果 |
|---|---|
| 生产代码扫 Token（5 数字＋KnowledgeBank＋legacy-knowledge＋legacy-id） | **0 命中** |
| `npm run build:strategy` | modules 67 / shims 7，bundle 内 Token=0 |
| `node dev/check-kbl-uniqueness.js` | PASS（known 0 / new 0；`KnowledgeCompatGetEntries=0`；`KnowledgeBank: undefined`） |
| `npm run verify`（8 步） | PASS（8/8，含确定性 validate/roundtrip/build） |
| `npm test` | 480 / 480 PASS（fail 0） |
| `node dev/p28/check-cross-layer.js` | PASS（新增违规 0） |
| `node dev/check-syntax.js` | 270 文件 / 0 错误 |
| 确定性 | `manifest.rootHash` 保持 `cee1070e…` 未漂移 |

## 6. 结论

当前生产代码旧数据/旧系统标记 = **0**；历史内容（archive/migration/冻结文档/历史报告）隔离保留并逐类登记；唯一性门禁已收紧并以 `KnowledgeCompat` 委托维持 Runtime 事实源唯一性。