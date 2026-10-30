# Third-Party Notices

This project includes material derived from third-party open-source software.
The notice below is reproduced to satisfy the upstream license terms.

## get-east-asian-width 1.7.0

The East Asian Width (Unicode `East_Asian_Width` values `W` and `F`) range
tables in
[`features/steps/sidebar_east_asian_width.js`](steps/sidebar_east_asian_width.js)
and
[`features/real-host-tests/terminal_screen.js`](real-host-tests/terminal_screen.js)
are derived from the generated lookup data published in
[`get-east-asian-width`](https://github.com/sindresorhus/get-east-asian-width)
1.7.0, which is distributed under the MIT license.

Both tables are kept local so the QA and real-host harnesses do not depend on
an undeclared transitive package at runtime.

The following license text is copied verbatim from the package's `license`
file as installed for version 1.7.0
(`node_modules/get-east-asian-width/license`):

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
