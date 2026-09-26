# Repair protocol — diagnose from current state and logs

Use this only for a concrete failure. Do not expand product scope.

1. Read `AGENTS.md` and `.agents/skills/observability-debugging/SKILL.md`.
2. Capture `git status --short` and relevant diff.
3. Identify the exact failing command/action and reproduce once if safe.
4. Read only `tail -n 80 logs/dev.latest.log` first.
5. Search logs for the exact error, request ID, component/category, or timestamp.
6. Expand to 200 lines only if the smaller context does not support a hypothesis.
7. Inspect the smallest code surface consistent with the evidence.
8. Explain the root cause in one short paragraph internally/summary, then apply the smallest coherent fix.
9. Run the narrow verification plus relevant frontend/Rust quality gate.
10. Confirm the error is gone from the new bounded log tail.
11. Stop. Do not refactor unrelated code.

Never paste API keys or full poem content into diagnostic output.
