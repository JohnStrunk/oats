from behave import then

@then(u'the "Successful CI" job conclusion shall be "{expected_conclusion}"')
def step_impl(context, expected_conclusion):
    actual = getattr(context, "actual_conclusion", None)
    assert actual == expected_conclusion, f"Expected gate conclusion '{expected_conclusion}', but got '{actual}'"
