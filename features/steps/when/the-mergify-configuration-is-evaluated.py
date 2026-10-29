from behave import when
from features.steps.mergify_helper import load_mergify_config

@when(u'the Mergify configuration is evaluated')
def step_impl(context):
    context.mergify_config = load_mergify_config()
