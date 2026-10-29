import re
from behave import when
from features.steps.workflow_helper import get_repo_root

@when(u'the CI workflow step actions are inspected')
def step_impl(context):
    workflows_dir = get_repo_root() / ".github" / "workflows"
    assert workflows_dir.exists(), f"Workflows directory not found at {workflows_dir}"

    actions = []
    workflow_files = list(workflows_dir.glob("*.yml")) + list(workflows_dir.glob("*.yaml"))
    assert len(workflow_files) > 0, f"No workflow files found in {workflows_dir}"

    uses_pattern = re.compile(r'^\s*(?:-\s+.*)?uses:\s*([^\s#]+)(?:\s+#\s*(.*))?$')

    for wf_file in workflow_files:
        with open(wf_file, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                stripped = line.strip()
                match = uses_pattern.match(line)
                if match:
                    action_ref = match.group(1)
                    comment = (match.group(2) or "").strip()
                    # Skip local action references like ./...
                    if action_ref.startswith("./") or action_ref.startswith("/"):
                        continue
                    actions.append({
                        "file": wf_file.name,
                        "line": line_no,
                        "action_ref": action_ref,
                        "comment": comment,
                        "raw_line": stripped,
                    })

    assert len(actions) > 0, "No external GitHub Actions references found across workflow files"
    context.workflow_actions = actions
