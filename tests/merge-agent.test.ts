import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMergeAgentPrompt, parseMergeAgentResult } from "../src/merge-agent";

test("buildMergeAgentPrompt includes merge context and guardrails", () => {
  const prompt = buildMergeAgentPrompt({
    repoRoot: "/repo",
    planPath: "/repo/.crack/plans/codex-merge-agent/plan.md",
    sourceBranch: "codex/merge-agent",
    mergeMode: "local",
    gitStatus: "UU src/merge.ts\n M tests/merge.test.ts\n",
    failedMergeCommand: "git merge codex/merge-agent failed with conflicts",
  });

  assert.match(prompt, /Repo root: \/repo/);
  assert.match(prompt, /Plan path: \.crack\/plans\/codex-merge-agent\/plan\.md/);
  assert.match(prompt, /Source branch: codex\/merge-agent/);
  assert.match(prompt, /Target branch: main/);
  assert.match(prompt, /Merge mode: local/);
  assert.match(prompt, /UU src\/merge\.ts/);
  assert.match(prompt, /git merge codex\/merge-agent failed with conflicts/);
  assert.match(prompt, /Do not implement new features/);
  assert.match(prompt, /Only edit files that are necessary to resolve the active merge conflict/);
  assert.match(prompt, /MERGE_READY summary="\.\.\."/);
  assert.match(prompt, /MERGE_NEEDS_WORK reason="\.\.\."/);
});

test("parseMergeAgentResult reads the last merge decision line", () => {
  assert.deepEqual(
    parseMergeAgentResult([
      "Earlier notes:",
      'MERGE_NEEDS_WORK reason="old conflict note"',
      "",
      "Final decision:",
      'MERGE_READY summary="Resolved file conflicts and ran checks."',
    ].join("\n")),
    {
      status: "ready",
      summary: "Resolved file conflicts and ran checks.",
    },
  );
});

test("parseMergeAgentResult reads needs-work decisions", () => {
  assert.deepEqual(parseMergeAgentResult('MERGE_NEEDS_WORK reason="Manual schema decision needed."'), {
    status: "needs_work",
    reason: "Manual schema decision needed.",
  });
});

test("parseMergeAgentResult rejects responses without a decision", () => {
  assert.throws(
    () => parseMergeAgentResult("I resolved the conflicts."),
    /did not contain a merge decision/,
  );
});
