# Migration Closure Report — Read-Only Audit (R-A07..R-A11)

Audit type: READ-ONLY (no business code / gates / tests / files modified)
Scope: `/Users/zhanggaozhang/Code/Homework Help`
Date: 2026-09-01
Live runtime entry: `practice.html:461 PracticeSession.start()`

## 1. Ten Audit Questions

**Q1 — Is there a single live runtime entry, and is it intact in the browser?**
NO. Live entry is `PracticeSession.start()` → `GenerationEngine.generate()`, but the browser chain is BROKEN (silently). `presentation-engine.js` is not loaded by `practice.html` and never registers `global.PresentationEngine`; `getPresentationEngine()` returns `null` in browser; `runPlans()` line 198 (`if (!PE) return null`) skips every plan → live generate() resolves `questions:[]` with no error. **P0-001.**

**Q2 — Are secondary/vestigial decision + generation centers inactive on the live path?**
MOSTLY. `generateViaEngine()` (practice.html:376/388/403) is dead/vestigial. Secondary difficulty center (`difficulty.js`/`difficulty-static.js`) is dormant on live Strategy path (guarded by `difficultyParams==null`). Not decisive — blocked by P0-001.

**Q3 — Does the generation engine honor the single decision authority (strategy) for KP/type/difficulty?**
YES on the live path (StrategyEngine/ComprehensiveStrategy → capability-resolver → question-type → difficulty → spiral → generator-selector). Dual-homed difficulty exists but is dormant. Lower confidence due to P0-001.

**Q4 — Are frozen-core files unchanged (no drift)?**
NO drift vs the baseline file, BUT the baseline itself was regenerated from a dirty working tree (see P-012): `renderer.js` (frozen) and `practice.html`/`graphic-renderer.js` (non-frozen) carry uncommitted changes that the baseline absorbed. `check-frozen-core` passes 93/93 `无变更` only relative to this regenerated baseline, not relative to committed HEAD `135ca55`.

**Q5 — Are contract/adapter mismatches within frozen files present (M4-R02)?**
YES (PRE-EXISTING at HEAD, verified in clean worktree). `legacy-plugin-adapter.js:189` sets `svg:` (FORBIDDEN_KEYS) and `answerMode:'choice'` (contract allows only input/read-aloud). Affects math-shapes/clock/patterns/number-sense/picture-equations. `verify:m4` exits 1. **P0 blocker for freeze-ready.**

**Q6 — Is regression green (M4-R16)?**
NO. `test:regression` (`test-generator-regression.js:267`) requires zero FAIL. Current PASS 214/FAIL 818/PLAN_ERROR 774; HEAD PASS 197/FAIL 835/PLAN_ERROR 774. NEVER green. **P0 blocker.**

**Q7 — Are baseline gates as-stated?**
NO — baseline was inaccurate. Tree state: `npm test` 0, `npm run verify` 7/7, `verify:m4` 1 (pre-existing), `verify-svg` 0, `test:regression` 1 (pre-existing), `check-duplicates` 0, `check-frozen-core` 0.

**Q8 — Are phantom/dead references non-runtime?**
YES (LOW). Phantom `require('../render.js')` (presentation-engine.js:180,204) and docs `scripts/enrich-knowledge-bank.js` (seo-monitoring.md:21). 0 phantom registry/script refs.

**Q9 — Are random/seed, validator, and graph-source-change concerns isolated to frozen/known files?**
PARTIAL. Verified: arithmetic.js uses deterministic `context.seed` (lines 29,91, `seedFor`); validator delegate `PE.generateQuestions(plan, {skipValidation})` lives in presentation-engine.js — the module NOT loaded in browser (ties back to P0-001); capability-resolver is bundled (functional) not standalone-global. KEEP_OPEN: graph-source-change (P-012) shows uncommitted changes in a frozen file, so provenance is NOT cleanly anchored to HEAD.

**Q10 — Is the stated READY baseline reproducible?**
NO — not reproducible given P0-001 + pre-existing gate failures. Cannot support a READY_FOR_MIGRATION_FREEZE verdict.

## 2. Verdict

**NOT_READY**

## 3. Problem Categories (P0–P10)

### BLOCKERS (must resolve before freeze)
- **P0-001** — PresentationEngine not loaded in browser; live `generate()` silently returns empty set.
- **P0 (M4-R02)** — Frozen legacy-plugin-adapter.js contract mismatch (`svg:` key, `answerMode:'choice'`) → `verify:m4` fails.
- **P0 (M4-R16)** — `test:regression` never green (818 FAIL / 774 PLAN_ERROR current).

### NON_BLOCKERS
- **P-006** — CYCLIC_GENERATION_CHAIN recorded (generator boundary).
- Numeric-boundary findings within regression FAIL population.
- Arithmetic.js:63-65 low-severity fallback re-decide (only when plan omits operation).

### KEEP_OPEN (provenance / accuracy)
- **P-012** — Frozen-core baseline regenerated from a DIRTY working tree, not committed HEAD `135ca55`. Uncommitted changes exist in `shared/presentation/renderer.js` (a FROZEN file, re-routes SVG through new `GraphicRenderer` facade) and `practice.html`, `shared/generator/graphic-renderer.js` (non-frozen). `check-frozen-core` passes 93/93 only because the baseline absorbs these uncommitted changes. "Frozen core" anchor does NOT represent the committed release state.

### KNOWN_DEBT
- Secondary/dormant legacy difficulty center (`difficulty.js`/`difficulty-static.js`) still loaded by practice.html:162-163.
- capability-resolver bundled via strategy-engine.bundle.js (functional in browser, but no standalone `window.CapabilityResolver` global; classified ACTIVE_RUNTIME not DEV_ONLY).
- Dual-homed difficulty decision authority.
- Randomness/validator/graph-source-change audits incomplete.

### FALSE_POSITIVES / LOW
- **P-010** phantom `require('../render.js')` (masked by PluginUtil guard).
- **P-011** phantom doc command `scripts/enrich-knowledge-bank.js` (file absent).
- Dead `generateViaEngine()` (practice.html:376/388/403).

## 4. Recheck Commands (read-only, recorded)
- `npm test` → exit 0
- `npm run verify` → 7/7
- `npm run verify:m4` → exit 1 (PRE-EXISTING, verified at HEAD 135ca55)
- `npm run verify-svg` → exit 0
- `npm run test:regression` → exit 1 (PRE-EXISTING, verified at HEAD)
- `npm run check-duplicates` → exit 0
- `npm run check-frozen-core` → exit 0 (93/93)

## 5. Statement of Scope
This audit is READ-ONLY. No fixes were made. Deliverables consist of this report plus:
- `migration-call-graph.json`
- `decision-authority-audit.json`
- `generator-boundary-audit.json`
- `legacy-lifecycle-audit.json`
- `dead-code-audit.json`
- `runtime-entry-audit.json`
- `migration-closure-summary.json`

## 6. Final Conclusion

Verdict: **NOT_READY for migration freeze.**

Decision is driven by four findings, three of which are independent of the Node-side gate results:
1. **P0-001** — the live browser generation path silently returns an empty question set (PresentationEngine not loaded, `runPlans` skips all plans).
2. **M4-R02** — frozen adapter/contract mismatch makes `verify:m4` fail.
3. **M4-R16** — `test:regression` is never green.
4. **P-012** — the frozen-core baseline is anchored to a dirty working tree, not committed HEAD, so the "frozen" claim is not release-anchored.

Because the primary runtime entry itself is broken in the browser, the migration cannot be declared closure-ready. Proceed only after: (a) wiring `presentation-engine.js` (+ `svg-core.js`/plugins) into the browser runtime, (b) resolving the adapter/contract mismatch and regression, and (c) committing/anchoring the frozen baseline to a clean HEAD.

Audit stops here; no fixes applied.
