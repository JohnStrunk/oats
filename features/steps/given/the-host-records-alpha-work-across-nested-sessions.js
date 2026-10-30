import { Given } from '@cucumber/cucumber'

Given('the host records alpha work across nested sessions', function () {
  // The same agent executes under different recorded models at each level.
  this.host.messages.child[0].agent = 'alpha'
  this.host.messages.grandchild[0].agent = 'alpha'
})
