import { After } from '@cucumber/cucumber'

After(function () { this.service?.dispose?.() })
