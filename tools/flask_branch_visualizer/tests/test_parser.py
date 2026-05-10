from __future__ import annotations

import unittest

from tools.flask_branch_visualizer.state import (
    completed_commit_unit_numbers,
    count_queued_requests,
    parse_plan_markdown,
)


class PlanParserTest(unittest.TestCase):
    def test_parse_plan_markdown_reads_only_weak_conventions(self) -> None:
        content = "\n".join(
            [
                "# Plan: Demo Visualizer",
                "",
                "Branch: codex/demo",
                "",
                "## Commit Units",
                "",
                "### Commit 1: Add snapshot model",
                "",
                "Create the model.",
                "",
                "### Commit 2 Render page",
                "",
                "Render it.",
                "",
                "### Commit 3:",
                "",
                "Fallback title.",
            ]
        )

        parsed = parse_plan_markdown(content)

        self.assertEqual(parsed["title"], "Demo Visualizer")
        self.assertEqual(parsed["branch"], "codex/demo")
        self.assertEqual(
            parsed["commit_units"],
            [
                {"number": 1, "title": "Add snapshot model"},
                {"number": 2, "title": "Render page"},
                {"number": 3, "title": "Commit unit 3"},
            ],
        )

    def test_log_and_queue_parsers_count_simple_markdown_markers(self) -> None:
        log_content = "\n".join(
            [
                "- Completed commit unit 2.",
                "- completed commit unit 1",
                "- Completed commit unit 2 again.",
            ]
        )
        queue_content = "\n".join(
            [
                "# Queue",
                "",
                "## Queued Request",
                "",
                "First.",
                "",
                "## Queued Request",
                "",
                "Second.",
            ]
        )

        self.assertEqual(completed_commit_unit_numbers(log_content), [1, 2])
        self.assertEqual(count_queued_requests(queue_content), 2)


if __name__ == "__main__":
    unittest.main()
