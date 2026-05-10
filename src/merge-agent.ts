import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { withCodexCliDefaults } from "./codex-cli";
import { runProcess } from "./process";

export type MergeMode = "local" | "remote";

export type MergeAgentInput = {
  repoRoot: string;
  planPath: string;
  sourceBranch: string;
  targetBranch?: string;
  mergeMode: MergeMode;
  gitStatus: string;
  failedMergeCommand: string;
};

export type MergeAgentResult =
  | {
      status: "ready";
      summary: string;
    }
  | {
      status: "needs_work";
      reason: string;
    };

export interface MergeAgent {
  resolveConflicts(input: MergeAgentInput): Promise<MergeAgentResult>;
}

export type CodexMergeAgentOptions = {
  command?: string;
  extraArgs?: string[];
};

export class CodexMergeAgent implements MergeAgent {
  private readonly command: string;
  private readonly extraArgs: string[];

  constructor(options: CodexMergeAgentOptions = {}) {
    this.command = options.command ?? "codex";
    this.extraArgs = options.extraArgs ?? [];
  }

  async resolveConflicts(input: MergeAgentInput): Promise<MergeAgentResult> {
    const finalMessage = await this.runCodex(buildMergeAgentPrompt(input), input.repoRoot);

    return parseMergeAgentResult(finalMessage);
  }

  private async runCodex(prompt: string, repoRoot: string): Promise<string> {
    const tempDir = await mkdtemp(path.join(tmpdir(), "crack-merge-agent-"));
    const outputPath = path.join(tempDir, "last-message.txt");

    try {
      const result = await runProcess(
        this.command,
        [
          "exec",
          "--json",
          "--cd",
          repoRoot,
          "--sandbox",
          "workspace-write",
          "--output-last-message",
          outputPath,
          ...withCodexCliDefaults(this.extraArgs),
          "-",
        ],
        { cwd: repoRoot, input: prompt },
      );

      if (result.status !== 0) {
        const details = result.stderr.trim() || result.stdout.trim();
        const suffix = details ? `: ${details}` : "";
        throw new Error(`Codex merge agent failed with exit code ${result.status}${suffix}`);
      }

      const finalMessage = await readFile(outputPath, "utf8").catch(() => "");
      return finalMessage.trim() || result.stdout.trim();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

export function buildMergeAgentPrompt(input: MergeAgentInput): string {
  const planPath = relativePath(input.repoRoot, input.planPath);
  const targetBranch = input.targetBranch ?? "main";

  return [
    "You are the merge conflict resolver for the Codex workflow orchestrator.",
    "Resolve only the current git merge conflicts and help verify the result.",
    "Do not implement new features, advance plan commit units, rewrite the plan, create commits, switch branches, abort merges, push, or open PRs.",
    "Only edit files that are necessary to resolve the active merge conflict.",
    "Use docs/workflow-design.md and the plan path as context only when needed.",
    "",
    "When finished, return exactly one final line in one of these forms:",
    'MERGE_READY summary="..."',
    'MERGE_NEEDS_WORK reason="..."',
    "",
    "Merge context:",
    `Repo root: ${input.repoRoot}`,
    `Plan path: ${planPath}`,
    `Source branch: ${input.sourceBranch}`,
    `Target branch: ${targetBranch}`,
    `Merge mode: ${input.mergeMode}`,
    "",
    "Current git status:",
    input.gitStatus.trim() ? fence(input.gitStatus) : "Clean",
    "",
    "Failed merge command summary:",
    input.failedMergeCommand.trim() ? fence(input.failedMergeCommand) : "Not provided",
  ].join("\n");
}

export function parseMergeAgentResult(text: string): MergeAgentResult {
  const line = lastMergeDecisionLine(text);

  if (line.startsWith("MERGE_READY ")) {
    const values = parseKeyValues(line.slice("MERGE_READY ".length));
    return {
      status: "ready",
      summary: values.get("summary") ?? "Merge conflicts resolved.",
    };
  }

  if (line.startsWith("MERGE_NEEDS_WORK ")) {
    const values = parseKeyValues(line.slice("MERGE_NEEDS_WORK ".length));
    return {
      status: "needs_work",
      reason: values.get("reason") ?? "Merge agent requested more work.",
    };
  }

  throw new Error(`Unknown merge agent decision: ${line}`);
}

function lastMergeDecisionLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.startsWith("MERGE_"));
  const line = lines.at(-1);

  if (!line) {
    throw new Error(`Merge agent response did not contain a merge decision: ${text.trim()}`);
  }

  return line;
}

function parseKeyValues(text: string): Map<string, string> {
  const values = new Map<string, string>();
  const pattern = /([A-Za-z][A-Za-z0-9]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    values.set(match[1], match[2] ?? match[3] ?? match[4] ?? "");
  }

  return values;
}

function fence(value: string): string {
  return ["```text", value.trim(), "```"].join("\n");
}

function relativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}
