import pathlib
from behave import given

@given(u'the repository contains YAML files and GitHub Actions workflow definitions')
def step_impl(context):
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
    workflow_dir = repo_root / ".github" / "workflows"
    context.workflow_dir = workflow_dir
