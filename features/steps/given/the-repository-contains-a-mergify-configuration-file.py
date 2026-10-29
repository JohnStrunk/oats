import pathlib
from behave import given

@given(u'the repository contains a Mergify configuration file')
def step_impl(context):
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
    path = repo_root / ".github" / "mergify.yml"
    context.mergify_config_path = path
