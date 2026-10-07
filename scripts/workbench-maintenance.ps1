param([switch]$Install)
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $workbenchRoot '.env.local'
$taskName = 'TencentMusicAgentWorkbenchMaintenance'
if ($Install) {
  $scriptPath = Join-Path $PSScriptRoot 'workbench-maintenance.ps1'
  $executable = (Get-Command powershell.exe).Source
  $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $scriptPath + '"'
  $action = New-ScheduledTaskAction -Execute $executable -Argument $arguments -WorkingDirectory $workbenchRoot
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -StartWhenAvailable
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Expire internal Agent test inputs through the authenticated maintenance API. Requires the local Node server.' | Out-Null
  Write-Output 'Local hourly maintenance task installed.'
  exit 0
}
try {
  $localValues = @{}
  if (Test-Path -LiteralPath $environmentPath) {
    foreach ($line in [System.IO.File]::ReadAllLines($environmentPath)) {
      if ($line -match '^(WORKBENCH_PUBLIC_ORIGIN|WORKBENCH_MAINTENANCE_TOKEN)=(.*)$') { $localValues[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
    }
  }
  $origin = $env:WORKBENCH_PUBLIC_ORIGIN
  $token = $env:WORKBENCH_MAINTENANCE_TOKEN
  if (-not $origin) { $origin = $localValues['WORKBENCH_PUBLIC_ORIGIN'] }
  if (-not $token) { $token = $localValues['WORKBENCH_MAINTENANCE_TOKEN'] }
  if (-not $origin -or -not $token -or [Text.Encoding]::UTF8.GetByteCount($token) -lt 32) { throw 'Missing maintenance configuration' }
  $uri = [Uri]$origin
  if ($uri.UserInfo -or $uri.Query -or $uri.Fragment -or ($uri.Scheme -ne 'https' -and $uri.Host -notin @('localhost','127.0.0.1','::1'))) { throw 'Invalid origin' }
  $result = Invoke-RestMethod -Method Post -Uri ($origin.TrimEnd('/') + '/api/internal/agent-workbench/maintenance') -Headers @{ Authorization = 'Bearer ' + $token } -ContentType 'application/json' -Body '{"contractVersion":1}' -TimeoutSec 30
  if ($result.contractVersion -ne 1 -or -not $result.data) { throw 'Invalid maintenance response' }
  $result.data | ConvertTo-Json -Compress
  exit 0
} catch {
  # Do not print exception text: transport exceptions may include request headers.
  Write-Error 'Workbench maintenance failed; check local server availability and machine credential configuration.'
  exit 1
}
