# Copy noble-bg-engine to client repos (so they use the in-repo copy after npm run build/start).
# Paths are derived from this script location so it works regardless of repo path.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$engineRoot = $ScriptDir
$source = Join-Path $engineRoot "packages\engine"
$codeRoot = Split-Path -Parent $engineRoot

if (-not (Test-Path $source)) {
  Write-Warning "Engine source not found: $source"
  exit 1
}

$dest1 = Join-Path $codeRoot "the-golden-ages\noble-bg-engine\packages\engine"
if (Test-Path $dest1) { Remove-Item $dest1 -Recurse -Force }
$parent1 = Split-Path -Parent $dest1
if (-not (Test-Path $parent1)) { New-Item -ItemType Directory -Path $parent1 -Force | Out-Null }
Copy-Item $source $dest1 -Recurse
Write-Host "Copied engine to the-golden-ages"

$dest2 = Join-Path $codeRoot "ZIA\noble-bg-engine\packages\engine"
if (Test-Path $dest2) { Remove-Item $dest2 -Recurse -Force }
$parent2 = Split-Path -Parent $dest2
if (-not (Test-Path $parent2)) { New-Item -ItemType Directory -Path $parent2 -Force | Out-Null }
Copy-Item $source $dest2 -Recurse
Write-Host "Copied engine to ZIA"

# Project folder is compile-game (not compile)
$dest3 = Join-Path $codeRoot "compile-game\noble-bg-engine\packages\engine"
if (Test-Path $dest3) { Remove-Item $dest3 -Recurse -Force }
$parent3 = Split-Path -Parent $dest3
if (-not (Test-Path $parent3)) { New-Item -ItemType Directory -Path $parent3 -Force | Out-Null }
Copy-Item $source $dest3 -Recurse
Write-Host "Copied engine to compile-game"

$dest4 = Join-Path $codeRoot "crown-duels\noble-bg-engine\packages\engine"
if (Test-Path $dest4) { Remove-Item $dest4 -Recurse -Force }
$parent4 = Split-Path -Parent $dest4
if (-not (Test-Path $parent4)) { New-Item -ItemType Directory -Path $parent4 -Force | Out-Null }
Copy-Item $source $dest4 -Recurse
Write-Host "Copied engine to crown-duels"
