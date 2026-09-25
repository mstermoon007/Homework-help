# FINAL-130 验收报告 — 服务器上传上线（专项最后动作）

| 字段 | 值 |
|---|---|
| 任务编号 | FINAL-130 |
| 任务名称 | 服务器上传上线：5.0.0 发布包全量部署至正式服务器 |
| 关联任务 | FINAL-120（发布包生成）/ FINAL-121（内容白名单检查）/ FINAL-122（离线全链验证）/ FINAL-123（上传验证中发现的死引用修复）/ FINAL-111（冻结后治理规则） |
| 验收时间 | 2026-09-25 16:42–16:44 CST（最终复验时间窗；部署时间 16:04–16:27 CST） |
| 正式域名 | http://home.modouyu.top |
| 服务器 | admin@121.89.94.239（SSH key 认证，nginx，仅 80 端口） |
| 部署目录 | /var/www/Homework-help |
| 发布版本 | 5.0.0 |
| 发布包 SHA256 | `d0a66e98e42a8192228f7ede172234e3d83bccb094bec33eff579f2766afad67` |
| **验收结论** | **✅ ACCEPTED（验收通过）** — 8 关流水线全部关闭，线上三层证据（HTTP/哈希/浏览器）一致 |

> 本报告所有数值均为 2026-09-25 当天实测值（本地磁盘 / 服务器 SSH / 公网 HTTP 出口三路采集），无占位、无历史沿用。

---

## 1. 验收结论

**FINAL-130 验收通过，FINAL 修复专项至此全部关闭。**

- 线上运行版本 = 冻结产物 5.0.0，571 个文件，与发布包/git HEAD 逐文件可哈希核对
- 8/21 旧版站点（126 文件多学科残留含 `.git`）已先备份再全量替换，无新旧混合态
- 强制流水线 8 个关卡全部按序执行并留证；上传后验证中发现的 FINAL-22 遗留死引用经用户裁决修复（FINAL-123），完整重跑流水线后重新上传，未在服务器上做任何直接修补
- 无 P0/P1/P 发布阻塞项；新增 1 条 P2 非阻塞运维观察（DEF-007，HTTPS 缺失，部署前即存在）

---

## 2. 强制流水线执行记录

用户为 FINAL-130 设定的强制顺序：**全部修复 → 全部测试 → 最终冻结 → 生成发布包 → 本地发布包验证 → Git clean → 确认服务器目标目录 → 上传**。

| # | 关卡 | 结果 | 证据 |
|---|---|---|---|
| 1 | 全部修复 | ✅ | FINAL-100~122 全部 VERIFIED（见 FINAL-REPAIR-STATUS.md），无 PENDING/IN_PROGRESS |
| 2 | 全部测试 | ✅ | check-all **28 PASS / 0 FAIL / 0 SKIP**（FINAL-92 双跑确定性 + FINAL-123 修复后再次双跑一致，含真实 Chrome E2E #15） |
| 3 | 最终冻结 | ✅ | docs/FINAL-FREEZE.md（24 字段）；冻结后政策 5 条生效；源码冻结基线 4123124 |
| 4 | 生成发布包 | ✅ | `git archive` 白名单出自冻结 commit；最终包 571 文件 / 3,401,320 字节 |
| 5 | 本地发布包验证 | ✅ | FINAL-122 干净解压+http.server 全链 5 步 PASS；FINAL-123 修复后重验 9 关键路径 200、compat 按预期 404 |
| 6 | Git clean | ✅ | 上传前 `git status` 空；收尾后 HEAD=4434400、工作树空 |
| 7 | 确认服务器目标目录 | ✅ | nginx -T 实测：`server_name home.modouyu.top` 与 `default_server`（server_name _）均 root=/var/www/Homework-help；nginx active |
| 8 | 上传 | ✅ | 备份→scp→hash 核对→暂存解压→原子切换→chown→线上三层验证（本报告 §6） |

---

## 3. 发布物清单

| 字段 | 值 |
|---|---|
| 包文件 | release/homework-help-5.0.0.tar.gz |
| 大小 | 3,401,320 字节（3.3M） |
| 文件数 | 571（tar 清单实测，目录条目已排除） |
| SHA256 | `d0a66e98e42a8192228f7ede172234e3d83bccb094bec33eff579f2766afad67` |
| 构建来源 | git commit `56b643a`（fix(FINAL-123)），`git archive` 白名单 pathspec，非工作目录产物 |
| 白名单边界 | 7 根页 + 376 knowledge 页 + feedback + shared/plugins/assets + sw.js + sitemap/robots/llms/CNAME/VERSION/LICENSE/README.md |
| 禁止项实测 | tests/dev/archive/migration/docs/node_modules/.git 等命中 **0**；旧 bundle 命中 0；compat 引用命中 0 |
| 可复现命令 | 见 release/RELEASE-MANIFEST-5.0.0.md §生成方式 |

包来源说明：当前仓库 HEAD=`4434400`（docs 登记提交），发布包构建于其前一个 commit `56b643a`；两者差异仅为 docs/ 登记文件（不在包白名单内），包内容与当前产品源码字节一致。

---

## 4. 服务器目标环境（SSH 实测）

| 项 | 实测值 |
|---|---|
| 主机 | 121.89.94.239，登录用户 admin（sudo 免密） |
| Web 服务 | nginx，systemctl active |
| 监听 | 80 端口（HTTP）；**无 443/SSL 监听**（DEF-007） |
| server 块 | ① default_server `server_name _` → /var/www/Homework-help；② `server_name home.modouyu.top` → /var/www/Homework-help |
| 部署目录 | `/var/www/Homework-help`（drwxr-xr-x，属主 www-data:www-data） |
| 部署文件数 | 571（sudo find 实测） |
| 线上 VERSION | 5.0.0 |
| 旧版残留 | chinese-types.html / english-types.html / pinyin-bank.js / banner.jpg / .git / docs/ 均不存在 |
| nginx 配置改动 | **零**（沿用既有 root 指向，本次只换目录内容） |

---

## 5. 部署过程（命令级留痕）

```
① 备份旧版
   sudo tar -czf /root/Homework-help.bak-20260925.tar.gz -C /var/www Homework-help
   → 2,574,586 字节，root:root（126 文件旧版完整备份，含 .git）

② 上传（本地→服务器）
   scp -i ~/.ssh/id_ed25519 release/homework-help-5.0.0.tar.gz admin@121.89.94.239:/tmp/
   → 服务器 sha256sum = d0a66e98... 与本地逐字节一致

③ 暂存解压（先验证，不动现役目录）
   sudo mkdir /var/www/Homework-help.new
   sudo tar -xzf ... --strip-components=1
   → 571 文件，VERSION=5.0.0，select.html/sw.js compat 命中=0

④ 原子切换
   sudo mv /var/www/Homework-help     /var/www/Homework-help.old-swap
   sudo mv /var/www/Homework-help.new /var/www/Homework-help
   sudo chown -R www-data:www-data /var/www/Homework-help
   sudo rm -rf /var/www/Homework-help.old-swap   （备份包在 /root，可回滚）
```

注：首次部署使用的是 FINAL-121 包（SHA256=5335c2c6...）；FINAL-123 修复后按完全相同流程以新包（d0a66e98...）做了第二次原子替换，当前线上为第二次部署结果。

---

## 6. 验证证据

### 6.1 本地门禁（部署前）

- `npm run check-all`（CHROME_BIN 指向真实 Google Chrome）**连续 2 跑：28 PASS / 0 FAIL / 0 SKIP / 28 项**
- 两次运行前后 `git diff --stat` 快照逐字节一致 → 检查零写入，确定性通过
- pre-commit 钩子：lint 0 违规 + 语法检查 PASS
- 修复 commit `56b643a`：2 files changed, 2 deletions(-)

### 6.2 离线发布包验证（部署前）

- 干净目录解压 571 文件，`python3 -m http.server` 根部署
- 9 个关键路径（/、select.html、knowledge 页、双 bundle、KBL manifest、VERSION、beian-icon、sw.js、sitemap）全部 HTTP 200
- `/shared/engine/knowledge-compat.js` 返回 404（文件已随 FINAL-22 删除，且不再被任何页面引用，404 为预期且无请求方）
- FINAL-122 全链记录：首页→知识页→练习→7 题型 21 题生成→打印（window.open 钩子 opens/writes/prints=1），详见 change-log FINAL-122

### 6.3 线上 HTTP 出口（2026-09-25 16:43 CST，公网实测）

**关键路径电池：23/23 全部 HTTP 200，NON200=0**

```
/  /VERSION  /index.html  /select.html  /practice.html
/math-types.html  /subject-types.html  /faq.html  /contact.html
/knowledge/knowledge-index.html  /knowledge/math-g1-down-u01-k001.html
/knowledge/knowledge-index.json
/shared/engine/strategy-engine.bundle.js  /shared/engine/presentation-engine.bundle.js
/shared/knowledge/manifest/manifest.json
/sitemap.xml  /robots.txt  /llms.txt  /sw.js  /CNAME
/assets/logo.webp  /assets/beian-icon.png  /feedback/feedback.html
```

- 旧版文件 6/6 返回 404：chinese-types.html、english-types.html、pinyin-bank.js、banner.jpg、/.git/config、/docs/ → 无新旧混合态
- sitemap.xml `<loc>` 计数 = **381**（5 公共 + 375 KP + 1 索引，与冻结一致）
- 裸 IP 经 default_server 访问 `/VERSION` 返回 5.0.0（两个 server 块内容一致）

### 6.4 线上↔源码哈希一致性：8/8 MATCH

公网 curl 取回内容与 `git show HEAD:<file>` 逐字节比对，全部 MATCH：

```
index.html  select.html  sw.js  practice.html
shared/engine/strategy-engine.bundle.js  shared/engine/presentation-engine.bundle.js
knowledge/math-g1-down-u01-k001.html  sitemap.xml
```

线上 select.html 与 sw.js 中 `knowledge-compat` 字符串计数均为 **0**。

### 6.5 真实浏览器线上冒烟（最终部署后）

| 步骤 | 结果 | 证据 |
|---|---|---|
| 首页 | PASS | 标题"小学练习本"、logo 渲染、页脚"版本 5.0.0"+ 陇ICP备2026008157号-1 + 公安备案 |
| select.html 选择页 | PASS | 标题"选择练习 · 小学练习本"，模式/科目/年级控件与"开始练习"按钮正常 |
| 题目生成 | PASS | select → practice 跳转，"一年级数学 · 综合练习" 生成 **19 题**，含图形识别/算术/应用题 |
| 打印 | PASS | "打印页面"按钮存在且可点击，无报错 |
| FINAL-123 DOM 级终验 | PASS | 全新 query URL 加载后 `domHasCompatScript=false`、`htmlHasCompat=false`、15 个 script[src] 无一指向 compat |

说明：测试浏览器长寿命 profile 在修复部署后仍短暂显示旧 compat console 条目，经 DOM 检查与 fetch 源码（includes('knowledge-compat')=false）证明该条目为旧导航累积残留，非当前页面发起；详见 change-log FINAL-123。

---

## 7. 过程中发现的问题与处置（FINAL-123）

| 项 | 内容 |
|---|---|
| 发现时机 | 第 8 关上传后首次浏览器冒烟（功能全通，但 select.html 有 1 条 console error） |
| 现象 | select.html 加载请求 `shared/engine/knowledge-compat.js` → 404 net::ERR_ABORTED |
| 根因 | FINAL-22 物理删除死桥接文件 knowledge-compat.js 时，同步了 `_bundle-env/practice.html`，漏清 **select.html:567 的 `<script>` 标签** 与 **sw.js CORE 预缓存清单 1 行**，共 2 处死引用 |
| 为何漏检 | FINAL-122 离线验证走"知识页 CTA 直达 practice.html"路径，不经过 select.html |
| 功能影响 | 零（能力已由 knowledge-context.js 接替；SW cacheAll 逐条 catch，不影响 install/activate/离线） |
| 处置裁决 | 用户明确选择"现在修，重跑流水线后重上"（FINAL-130 禁循环规则的一次性授权例外） |
| 修复内容 | 删 2 行，零逻辑变化；全产品面 7 根页+376 knowledge 页+feedback 扫描确认悬挂引用仅此 2 处 |
| 重跑记录 | check-all 28/0 双跑 → commit 56b643a → 重出包（571 文件，d0a66e98...）→ 离线重验证 → scp 重传 → 原子替换 → §6.3–6.5 全部复测 |
| 服务器侧是否热修 | **否**。服务器从未被直接编辑，所有线上内容均来自发布包，保证"构建产物=线上" |

---

## 8. 回滚方案

旧版完整备份保留在服务器：

```
/root/Homework-help.bak-20260925.tar.gz   2,574,586 字节   2026-09-25 16:04 CST
```

如需回滚（admin@121.89.94.239）：

```bash
sudo rm -rf /var/www/Homework-help
sudo mkdir -p /var/www/Homework-help
sudo tar -xzf /root/Homework-help.bak-20260925.tar.gz -C /var/www --strip-components=0
# 备份包内顶层目录即 Homework-help/，解压后恢复原属主：
sudo chown -R www-data:www-data /var/www/Homework-help
```

建议保留至下一个版本发布后再清理。

---

## 9. 遗留事项与风险

| 级别 | 事项 | 说明 / 处置 |
|---|---|---|
| P2（DEF-007） | 正式域名仅 HTTP 80，无 HTTPS | 部署前即存在的服务器配置现状，本次零配置改动；影响：非安全上下文下 Service Worker 不注册，线上无离线能力（localhost 不受影响）。属服务器运维侧改造，已登记 FINAL-REPAIR-DEFERRED.md，不在本专项处理。**当日补遗：已由 FINAL-131 修复（2026-09-25，Let's Encrypt + 443 + 301 跳转，SW 实测注册成功，DEF-007=FIXED）** |
| 已知窗口效应 | 同版本号替换不轮换 SW 缓存名 | 两次部署（16:04→16:27）间隔内访问过的浏览器可能持有旧 select.html 磁盘缓存，差异仅 1 条无害 404 console 提示，刷新即自愈；新用户无影响；线上 HTTP 环境 SW 本就不注册，实际影响面更小 |
| default_server | 裸 IP 访问同样返回本站内容 | 沿用既有配置，未做变更；如不希望 IP 直连可访问，后续运维侧调整 |

无其他风险：备份可回滚、nginx 配置零改动、发布包可逐文件哈希复核、产品功能三层验证通过。

---

## 10. 审计轨迹

| 类型 | 标识 |
|---|---|
| 修复提交 | `56b643a` fix(FINAL-123): 清除 knowledge-compat.js 删除后的 2 处死引用（2 files, +0/-2） |
| 登记提交 | `4434400` docs(FINAL-123/130): 死引用修复登记 + 服务器上线完成登记 |
| 前置提交 | `1b627ab` FINAL-122 / `0a561a7` FINAL-121 / `bf7f625` FINAL-121 包基线 / `9feccd6` FINAL-120 |
| 审计日志 | docs/P28/change-log.md：FINAL-130、FINAL-123 两条六字段记录 |
| 任务状态 | docs/FINAL-REPAIR-STATUS.md：FINAL-130 = VERIFIED、FINAL-123 = VERIFIED |
| 延后清单 | docs/FINAL-REPAIR-DEFERRED.md：DEF-007（P2，HTTPS） |
| 发布清单 | release/RELEASE-MANIFEST-5.0.0.md（来源 commit / SHA256 / 白名单 / 复现命令） |
| 侧车校验 | release/homework-help-5.0.0.tar.gz.sha256 |
| 冻结基线 | docs/FINAL-FREEZE.md；源码冻结基线 4123124 |

---

## 11. 验收签署

| 角色 | 结论 |
|---|---|
| 自动化门禁（check-all 28 项，含真实浏览器 E2E） | PASS |
| 离线发布包验证（FINAL-122 + FINAL-123 复测） | PASS |
| 线上 HTTP 出口验证（23/23 + 旧文件 6/6 404 + sitemap 381） | PASS |
| 线上↔源码哈希一致性（8/8 MATCH + 包 hash 端到端一致） | PASS |
| 真实浏览器冒烟（首页/选择/生成 19 题/打印/DOM 终验） | PASS |
| 回滚能力（备份包在位） | PASS |
| 发布阻塞项（P0/P1） | 0 |
| **最终结论** | **ACCEPTED — FINAL-130 关闭，5.0.0 已在 http://home.modouyu.top 正式运行** |
