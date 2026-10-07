param()
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $workbenchRoot '.env.local'
if (-not (Test-Path -LiteralPath $environmentPath)) { throw 'Existing .env.local is required; configure Supabase manually first.' }
$environmentText = [System.IO.File]::ReadAllText($environmentPath)
$values = @{
  WORKBENCH_ACCESS_PASSWORD = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  WORKBENCH_SESSION_SECRET = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  WORKBENCH_MAINTENANCE_TOKEN = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  WORKBENCH_PUBLIC_ORIGIN = 'http://localhost:3000'
}
foreach ($entry in $values.GetEnumerator()) {
  $pattern = '(?m)^' + [regex]::Escape($entry.Key) + '=(.*)$'
  $match = [regex]::Match($environmentText, $pattern)
  if (-not $match.Success) { $environmentText = $environmentText.TrimEnd() + "`n" + $entry.Key + '=' + $entry.Value + "`n" }
  elseif ([string]::IsNullOrWhiteSpace($match.Groups[1].Value)) { $environmentText = [regex]::Replace($environmentText, $pattern, $entry.Key + '=' + $entry.Value) }
}
[System.IO.File]::WriteAllText($environmentPath, $environmentText, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Internal credentials configured locally. Values remain in ignored .env.local; existing values were preserved.'
