import { Given } from '@cucumber/cucumber'

Given('the host has a known cost with unavailable tokens', function () {
  delete this.host.messages.root.find((message) => message.id === 'root-1').tokens
})
