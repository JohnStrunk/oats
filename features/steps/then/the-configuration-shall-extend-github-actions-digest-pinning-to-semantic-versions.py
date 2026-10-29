from behave import then

@then(u'the configuration shall extend GitHub Actions digest pinning to semantic versions')
def step_impl(context):
    config = getattr(context, "renovate_config", {})
    extends = config.get("extends", [])
    assert "helpers:pinGitHubActionDigestsToSemver" in extends, (
        f"Expected 'helpers:pinGitHubActionDigestsToSemver' in extends: {extends}"
    )
