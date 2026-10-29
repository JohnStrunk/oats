import pathlib
from behave import given

@given(u'the repository contains markdown documentation files')
def step_impl(context):
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent.parent
    md_files = list(repo_root.glob("*.md")) + list((repo_root / "features").glob("**/*.md"))
    assert len(md_files) > 0, "No markdown files found in repository"
    context.markdown_files = md_files
