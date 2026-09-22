# P28-BASELINE — 最终治理基线（P28-00）

> 由 `dev/p28/build-baseline.js` **只读**生成；可重复运行，结果仅随数据源变化。
> 本阶段（P28-00）红线：不修改业务代码、不删除文件、不修改测试；本脚本仅产出 `docs/archive/phases/p28/` 与 `dev/p28/reports/`。

## 0. 基线快照

| 项 | 值 |
| --- | --- |
| 生成时间 | 2026-09-21T15:06:49.105Z |
| 版本 | 5.0.0 |
| Git commit | dabe71c (01page-report) |
| 扫描目录 | `shared` `scripts` `tools` `tests` `docs` `kbl` `knowledge` `plugins` `archive` `migration` `.github` |
| 文件总数 | **946** |
| 代码行总数（文本类） | **889,964** |
| 字节数 | 29,399,519 |
| 依赖边数（repo 内 JS 模块间） | 310 / 模块数 334 |

### 目录存在性

| 目录 | 存在 | 文件数 |
| --- | --- | --- |
| `src` | ❌ **缺失** | 0 |
| `shared` | ✅ | 167 |
| `scripts` | ✅ | 7 |
| `tools` | ✅ | 9 |
| `tests` | ✅ | 60 |
| `docs` | ✅ | 91 |
| `kbl` | ✅ | 46 |
| `knowledge` | ✅ | 377 |
| `plugins` | ✅ | 6 |
| `archive` | ✅ | 162 |
| `migration` | ✅ | 18 |
| `.github` | ✅ | 3 |

> ⚠️ 任务书目标目录 `src/` **不存在**：本仓库业务源码承载于 `shared/`（319 目录为铺设基准），扫描按实际目录归集。

## 1. 文件类型统计

| 扩展名 | 文件数 | 占比 |
| --- | --- | --- |
| `.html` | 377 | 39.9% |
| `.js` | 334 | 35.3% |
| `.md` | 127 | 13.4% |
| `.json` | 86 | 9.1% |
| `.other` | 13 | 1.4% |
| `.css` | 7 | 0.7% |
| `.yml` | 2 | 0.2% |
| `.svg` | 0 | 0.0%（SVG 由 JS 生成器/插件动态产出，无静态 SVG 文件） |

## 2. 行为类别统计

| 类别 | 文件数 |
| --- | --- |
| Tests | 110 |
| Generator | 92 |
| KBL | 46 |
| Renderer | 21 |
| Validator | 18 |
| Plugin | 12 |
| Bundles | 2 |

> 口径：按路径关键字归类（Generator=generator/generation、Validator=validator、Renderer=presentation/render、Plugin=plugin、KBL=kbl/、Tests=tests/、Bundles=bundle）。一个文件可属多类。

## 3. LEGACY 标记扫描

| 标记 | 命中次数 | 命中文件数 |
| --- | --- | --- |
| TODO | 5 | 5 |
| FIXME | 2 | 2 |
| HACK | 0 | 0 |
| LEGACY | 14 | 5 |
| DEPRECATED | 0 | 0 |
| COMPAT | 2 | 2 |
| BRIDGE | 2 | 2 |
| TEMP | 0 | 0 |
| DEBUG | 6 | 3 |

影响文件数：**15**（全量逐文件见 `P28-LEGACY-MATRIX.json`）。

> 提示：`BRIDGE/DEBUG/TEMP` 在本仓库存在架构性/日志性正当用途（如 `shared/bridge`、`console.debug`），命中数不代表缺陷，仅作治理扫描基线；后续 P28.02 由人工判定。

## 4. 风险调用扫描

| 级别 | 文件数 |
| --- | --- |
| HIGH（eval/new Function/write/innerHTML/outerHTML/rawHtml/rawSvg） | 7 |
| MEDIUM（Math.random） | 25 |
| INFO（require/import 常规模块使用） | 305 |

> 提示：本项目数学 RNG 约束**禁止用 Math.random**（`shared/generator/core/rng.js`），命中文件为后续专项审查对象；require/import 仅作依赖统计、不算风险。全量见 `P28-RISK-MATRIX.json`。

## 5. 依赖矩阵摘要

- Repo 内可解析 JS 模块：334
- 解析到的同仓依赖边：310
- Fan-in Top 10：

1. `shared/generator/core/rng.js` × 27
2. `shared/knowledge/question-type-registry.js` × 19
3. `shared/strategy/strategy-error.js` × 14
4. `shared/validator/question-validator.js` × 12
5. `shared/svg/svg-core.js` × 7
6. `shared/core/common.js` × 7
7. `shared/knowledge/runtime/knowledge-contract.js` × 7
8. `shared/validator/duplicate-validator.js` × 6
9. `shared/catalog/difficulty.js` × 6
10. `shared/generator/generator-registry.js` × 6

全量节点与边见 `P28-DEPENDENCY-MATRIX.json`。

## 6. 产物清单

| 文件 | 说明 |
| --- | --- |
| `docs/archive/phases/p28/P28-BASELINE.md` | 本文档（聚合基线） |
| `docs/archive/phases/p28/P28-FILE-MATRIX.json` | 文件清单 + 类型/类别矩阵 |
| `docs/archive/phases/p28/P28-DEPENDENCY-MATRIX.json` | 同仓依赖边矩阵（含 fan-in） |
| `docs/archive/phases/p28/P28-LEGACY-MATRIX.json` | LEGACY 标记命中矩阵 |
| `docs/archive/phases/p28/P28-RISK-MATRIX.json` | 风险调用命中矩阵 |
| `dev/p28/reports/*.json` | 相同内容副本（CI 消费） |

## 7. 复现

```bash
node dev/p28/build-baseline.js   # 只读；产出 docs/archive/phases/p28/ 五件套
```
