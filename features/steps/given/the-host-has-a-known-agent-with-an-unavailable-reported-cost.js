import { Given } from '@cucumber/cucumber'

Given('the host has a known agent with an unavailable reported cost', function () {
  this.host.messages.root.find((message) => message.id === 'zero').agent = 'alpha'
  this.host.messages.root.find((message) => message.id === 'missing').agent = 'alpha'
})
