from behave import then

@then(u'the docker package rule shall specify a weekly schedule')
def step_impl(context):
    rule = getattr(context, "docker_rule", {})
    schedules = rule.get("schedule", [])
    assert len(schedules) > 0, f"Expected non-empty schedule in docker rule: {rule}"
    # Check that schedule contains weekly indication like a specific day (e.g. monday)
    schedule_str = " ".join(schedules).lower()
    has_weekly = any(day in schedule_str for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "week"])
    assert has_weekly, f"Schedule does not specify weekly timing: {schedules}"
