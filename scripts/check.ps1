$ErrorActionPreference = 'Stop'
$env:PLAYWRIGHT_BROWSERS_PATH = "$PSScriptRoot\..\work\browsers"
$checks = @(
  @('node_modules/typescript/bin/tsc', '--noEmit'),
  @('node_modules/eslint/bin/eslint.js', '.'),
  @('node_modules/vitest/vitest.mjs', 'run'),
  @('node_modules/vite/bin/vite.js', 'build'),
  @('node_modules/@playwright/test/cli.js', 'test')
)
foreach ($check in $checks) {
  & node @check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

