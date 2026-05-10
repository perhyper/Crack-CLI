from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.flask_branch_visualizer.state import (
    read_repository_snapshot,
)


class RepositorySnapshotTest(unittest.TestCase):
    def test_missing_crack_state_returns_empty_snapshot_without_initializing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / ".git").mkdir()

            snapshot = read_repository_snapshot(root)

            self.assertFalse(snapshot["initialized"])
            self.assertEqual(snapshot["plans"], [])
            self.assertFalse((root / ".crack").exists())
            self.assertTrue(any(".crack" in warning for warning in snapshot["warnings"]))
            self.assertEqual(snapshot["git"]["branches"], [])

    def test_snapshot_summarizes_plan_files_and_survives_empty_git_data(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            nested = root / "src" / "nested"
            plan_dir = root / ".crack" / "plans" / "demo"
            nested.mkdir(parents=True)
            (root / ".git").mkdir()
            plan_dir.mkdir(parents=True)
            (plan_dir / "plan.md").write_text(
                "\n".join(
                    [
                        "# Plan: Demo Visualizer",
                        "",
                        "Branch: codex/demo",
                        "",
                        "### Commit 1: Add snapshot model",
                        "",
                        "### Commit 2: Render page",
                        "",
                    ]
                ),
                encoding="utf-8",
            )
            (plan_dir / "queue.md").write_text(
                "\n".join(["# Queue", "", "## Queued Request", "", "Follow up."]),
                encoding="utf-8",
            )
            (plan_dir / "log.md").write_text("- Completed commit unit 1.\n", encoding="utf-8")

            snapshot = read_repository_snapshot(nested)

            self.assertTrue(snapshot["initialized"])
            self.assertEqual(snapshot["repo_root"], str(root.resolve()))
            self.assertEqual(len(snapshot["plans"]), 1)

            plan = snapshot["plans"][0]
            self.assertEqual(plan["title"], "Demo Visualizer")
            self.assertEqual(plan["branch"], "codex/demo")
            self.assertEqual(plan["relative_plan_path"], ".crack/plans/demo/plan.md")
            self.assertEqual(plan["total_commit_unit_count"], 2)
            self.assertEqual(plan["completed_commit_unit_count"], 1)
            self.assertEqual(plan["completed_commit_unit_numbers"], [1])
            self.assertEqual(plan["queue_request_count"], 1)
            self.assertEqual(plan["next_commit_unit"], {"number": 2, "title": "Render page"})
            self.assertEqual(snapshot["git"]["recent_commits"], [])
            self.assertTrue(any("Git command failed" in warning for warning in snapshot["warnings"]))


if __name__ == "__main__":
    unittest.main()
