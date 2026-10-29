import pathlib
from behave import given

@given(u'the repository contains a Renovate configuration file')
def step_impl(context):
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
    path = repo_root / ".github" / "renovate.json5"
    if not path.exists():
        path = repo_root / ".github" / "renovate.json"
    context.renovate_config_path = path
