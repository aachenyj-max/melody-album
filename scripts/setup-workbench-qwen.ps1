param([switch]$Live)
$ErrorActionPreference = 'Stop'
$workbenchRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $workbenchRoot '.env.local'
if (-not (Test-Path -LiteralPath $environmentPath)) { throw 'Configure the existing .env.local first.' }
$environmentText = [System.IO.File]::ReadAllText($environmentPath)
if ($Live) {
  $keyMatch = [regex]::Match($environmentText, '(?m)^PI_LLM_API_KEY=(.*)$')
  $keyValue = $keyMatch.Groups[1].Value.Trim().Trim('"').Trim("'")
  if (-not $keyMatch.Success -or [string]::IsNullOrWhiteSpace($keyValue) -or $keyValue.StartsWith('replace-')) {
    throw 'Fill PI_LLM_API_KEY in .env.local before enabling live. No configuration was changed.'
  }
}
$values = @{
  PI_LLM_PROVIDER = 'alibaba'
  PI_LLM_MODEL = 'qwen3-vl-flash'
  PI_LLM_API = 'openai-completions'
  PI_LLM_BASE_URL = 'https://llm-a5ntatubdh5b5n88.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
  PI_EXECUTION_MODE = $(if ($Live) { 'live' } else { 'demo' })
}
foreach ($entry in $values.GetEnumerator()) {
  $pattern = '(?m)^' + [regex]::Escape($entry.Key) + '=([^\r\n]*)'
  if ([regex]::IsMatch($environmentText, $pattern)) {
    $environmentText = [regex]::Replace($environmentText, $pattern, $entry.Key + '=' + $entry.Value)
  } else {
    $environmentText = $environmentText.TrimEnd() + "`n" + $entry.Key + '=' + $entry.Value + "`n"
  }
}
if (-not [regex]::IsMatch($environmentText, '(?m)^PI_LLM_API_KEY=')) {
  $environmentText = $environmentText.TrimEnd() + "`nPI_LLM_API_KEY=`n"
}
[System.IO.File]::WriteAllText($environmentPath, $environmentText, [System.Text.UTF8Encoding]::new($false))
Write-Output ('Qwen configuration saved locally; mode=' + $values.PI_EXECUTION_MODE + '. API key was preserved and not printed. Restart the server to apply.')
