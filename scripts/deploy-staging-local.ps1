$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing .env. Copy .env.example or create .env with CLOUDFLARE_API_TOKEN."
}

Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()

  if ($line.Length -eq 0 -or $line.StartsWith("#")) {
    return
  }

  $parts = $line -split "=", 2
  if ($parts.Count -ne 2) {
    throw "Invalid .env line: $line"
  }

  $name = $parts[0].Trim()
  $value = $parts[1].Trim()

  if ($name -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    throw "Invalid environment variable name in .env: $name"
  }

  if ($value.Length -ge 2) {
    $first = $value.Substring(0, 1)
    $last = $value.Substring($value.Length - 1, 1)

    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }

  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
  throw "CLOUDFLARE_API_TOKEN is empty in .env."
}

$projectName = $env:CLOUDFLARE_PAGES_PROJECT
if ([string]::IsNullOrWhiteSpace($projectName)) {
  $projectName = "miraichi-staging"
}

Push-Location $repoRoot
try {
  pnpm run verify:staging
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  pnpm dlx wrangler pages deploy apps/web/dist --project-name $projectName
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Pop-Location
}
