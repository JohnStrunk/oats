import pathlib
from behave import given

@given(u'the repository contains executable shell scripts')
def step_impl(context):
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
    sh_files = list(repo_root.glob("**/*.sh"))
    context.shell_files = sh_files
