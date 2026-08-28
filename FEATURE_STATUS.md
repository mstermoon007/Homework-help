# Feature Status Tracker

## Purpose
Track the status of all product features from documentation through implementation, ensuring documentation stays in sync with actual code.

## Status Values
- **planned**: Feature described in docs but not yet started
- **developing**: Feature currently being implemented
- **testing**: Feature implemented, QA in progress
- **released**: Feature fully deployed and working
- **deprecated**: Feature removed from product

## Feature Status List

### Feedback System
- **Doc Status**: implemented
- **Code Status**: released (standalone `feedback/feedback.html` + `feedback/feedback.css` + `feedback/feedback.js`)
- **Backend**: GitHub Pages 兼容——`feedback.js` 提交到可配置 `FEEDBACK_ENDPOINT`（Formspree/Getform 等静态表单服务，原生支持截图附件邮件）；留空时自动降级为 `mailto:317411213@qq.com` 兜底
- **Entry**: `index.html` 悬浮胶囊玻璃按钮 `.feedback-entry-btn` → `feedback/feedback.html`

### SEO & Metadata
- **Doc Status**: documented in docs/seo-monitoring.md
- **Code Status**: partially implemented - meta tags exist, some improvements needed
- **Action**: Complete SEO metadata per Task 16

### Print System
- **Doc Status**: documented
- **Code Status**: 90/90 plugins have printConfig (Task 15 complete)
- **Action**: Complete and verified

### CSS Governance
- **Doc Status**: documented in task descriptions
- **Code Status**: 0 inline styles remaining (from 237, Task 14)
- **Action**: Verified and complete

### SW Cache Upgrade
- **Doc Status**: documented in task description
- **Code Status**: 5/5 regression tests passing (Task 09)
- **Action**: Verified and complete

### Unified Version System
- **Doc Status**: documented
- **Code Status**: shared/version.js imported by sw.js (Task 08)
- **Action**: Verified and complete

### Subject Page Unification
- **Doc Status**: documented
- **Code Status**: subject-types.html with SUBJECT_CONFIG (Task 13)
- **Action**: Verified and complete

### Plugin Fingerprint System (Task 12)
- **Doc Status**: RELEASED — implemented and wired into the quality gate
- **Code Status**: `dev/plugin-fingerprint.js` — unified 3-level fingerprint + runtime question-duplicate measurement + fix-category attribution
  - L1 content hash (MD5 of normalized source)
  - L2 parameter signature (randInt/shuffle argument shapes)
  - L3 structure fingerprint (subject:title:kp-set:methods)
  - Runtime duplicate rate: ROUNDS×COUNT question generation, cross-round repeat rate
  - Fix categories: `weak-variation` / `no-generate` / `no-randomization` / `small-pool` / `pool-too-small` / `ok`
- **Duplicate Rate**: `npm run check-fingerprint` → report in `dev/fingerprint-report.json` / `.md`
  - **Baseline (2026-08-28): 0/82 math plugins over their per-grade threshold** (all 82 `ok`)
  - Root cause fixed across 29+ plugins: question objects nested `q`/`svg` inside `data`, collapsing the fingerprint to the answer alone; exposed top-level `q`/`svg` + widened randInt ranges + module-level cross-call dedup for competition plugins
  - Code-level duplication: 0 groups (plugins are structurally distinct; prior "26/82 >50%" was a looser heuristic)
- **Action**: System landed and serving as the monitoring baseline. Re-run `npm run check-fingerprint` to watch for regressions.

### Quality Gate
- **All checks**: passing ✅
- **Status**: project development environment ready
