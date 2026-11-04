$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$gameNode = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $runtimeRoot 'node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $gameNode)) { throw '需要先安装 Node.js 22.12 或更新版本。' }

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'))) {
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
  $gamePnpm = if ($pnpmCommand) { $pnpmCommand.Source } else { Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd' }
  if (-not (Test-Path -LiteralPath $gamePnpm)) { throw '需要先安装 pnpm，然后执行 pnpm install。' }
  & $gamePnpm install
  if ($LASTEXITCODE -ne 0) { throw '依赖安装未完成，请检查上面的错误。' }
}

Write-Host 'Hamilton — 1776: http://127.0.0.1:1776/'
& $gameNode (Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js') --host 127.0.0.1 --port 1776 --strictPort
