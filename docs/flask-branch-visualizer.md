# Flask Branch Visualizer

`tools/flask_branch_visualizer` is a local-only browser view for Crack plan progress, local branches, and recent commits.

The server is read-only. It reads `.crack/` Markdown state and git history, but it does not modify plan, queue, log, inbox, PR lock, branch, or commit state.

## Run Locally

```bash
source "$(git rev-parse --show-toplevel)/myenv/bin/activate"
pip install -r tools/flask_branch_visualizer/requirements.txt
python tools/flask_branch_visualizer/app.py --repo . --port 5050
```

Open `http://127.0.0.1:5050` after the server starts. The default bind address is `127.0.0.1` for local development.

Useful options:

```bash
python tools/flask_branch_visualizer/app.py --repo /path/to/repo --host 127.0.0.1 --port 5050 --max-commits 12
```

## Verify

Run the full Python visualizer tests:

```bash
python -m unittest discover tools/flask_branch_visualizer/tests
```

Run the parser-only tests when dependencies are not installed and you want to isolate Markdown parsing behavior:

```bash
python -m unittest tools.flask_branch_visualizer.tests.test_parser
```

Flask route tests live in `tools.flask_branch_visualizer.tests.test_app` and run when Flask is installed from the requirements file. Without Flask, those tests are skipped so parser and snapshot failures remain visible.

Run the existing TypeScript CLI tests:

```bash
npm test
```
