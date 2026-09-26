# Task 10 — final structural and dependency audit

Execute only this task. Do not add product scope.

Read:

- `AGENTS.md`
- `.agents/skills/tiger-style/SKILL.md`
- `.agents/skills/structural-refactor/SKILL.md`
- `_agent-bootstrap/specs/PRODUCT.md`
- `_agent-bootstrap/specs/ARCHITECTURE.md`

## Audit

Review the generated implementation for structural problems typical of agent-written code:

- giant `App.tsx`, giant graph component, or giant Rust `lib.rs`;
- duplicated geometry/metric calculations;
- duplicated state that can diverge;
- SQL leaking into frontend;
- Gemini HTTP details leaking through unrelated modules;
- provider DTOs used as UI/domain state everywhere;
- scattered Tauri command strings;
- swallowed errors / broad `catch` blocks;
- `unwrap`/`expect` in runtime Rust;
- stale/unused dependencies;
- dead placeholder components;
- unsafe secret logging;
- full poem logging;
- uncontrolled retries/timeouts;
- generic smoothing that misrepresents drop/spike semantics;
- stale docs;
- over-fragmentation into tiny meaningless files.

## Refactor only where evidence justifies it

Line count alone is not a verdict. Refactor along semantic responsibility/coupling seams and preserve behavior.

Do not create abstractions for future cloud scale, plugin systems, multi-user support, or provider polymorphism.

## Final verification

Run complete frontend quality gates, Rust fmt/clippy/check, and a logged smoke launch. Inspect a bounded tail of `logs/dev.latest.log` for unresolved warnings/errors.

## Final report

Create `docs/implementation-report.md` containing:

- final architecture tree at a useful depth;
- important dependencies and why each exists;
- persistence schema summary;
- Gemini integration summary;
- logging/debug commands;
- known limitations (provider context limits, subjective model interpretation, model availability/free-tier limits);
- no roadmap unless an actual unfinished requirement remains.

Stop when the current requested product is coherent and runnable.
