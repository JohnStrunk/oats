import pathlib
from behave import given

@given(u'the repository working tree contains source files and documentation')
def step_impl(context):
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
    files = list(repo_root.iterdir())
    assert len(files) > 0, "Repository root is unexpectedly empty"
