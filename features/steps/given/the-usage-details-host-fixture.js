import { Given } from '@cucumber/cucumber'

Given('the usage details host fixture {string}', function (name) {
  this.detailsFixtureName = name
})
