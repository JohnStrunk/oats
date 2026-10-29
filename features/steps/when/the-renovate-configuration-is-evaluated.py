from behave import when
from features.steps.renovate_helper import load_renovate_config

@when(u'the Renovate configuration is evaluated')
def step_impl(context):
    config = load_renovate_config()
    context.renovate_config = config
