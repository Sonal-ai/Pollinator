param([switch]$InstallCore)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$firmwareRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$firmwareTools = Join-Path $firmwareRoot '.local-tools/arduino'
$firmwareCliFolder = Join-Path $firmwareTools 'cli-1.5.1'
New-Item -ItemType Directory -Force -Path $firmwareCliFolder | Out-Null
$firmwareArchive = Join-Path $firmwareTools 'arduino-cli_1.5.1_Windows_64bit.zip'
$firmwareDigest = 'fabe42e0eb04d00e776a66178299ff95a46c623dbc260f997e58fd514853dd40'
if (-not (Test-Path -LiteralPath $firmwareArchive)) {
  Invoke-WebRequest -Uri 'https://github.com/arduino/arduino-cli/releases/download/v1.5.1/arduino-cli_1.5.1_Windows_64bit.zip' -OutFile $firmwareArchive
}
if ((Get-FileHash -LiteralPath $firmwareArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $firmwareDigest) { throw 'Official Arduino CLI archive checksum mismatch' }
$firmwareCli = Join-Path $firmwareCliFolder 'arduino-cli.exe'
if (-not (Test-Path -LiteralPath $firmwareCli)) { Expand-Archive -LiteralPath $firmwareArchive -DestinationPath $firmwareCliFolder }
foreach ($firmwareSubfolder in @('data','downloads','user','build-cache')) { New-Item -ItemType Directory -Force -Path (Join-Path $firmwareTools $firmwareSubfolder) | Out-Null }
$firmwareConfig = Join-Path $firmwareTools 'arduino-cli.yaml'
function ConvertTo-FirmwareYamlPath([string]$value) { return ($value.Replace('\','/') | ConvertTo-Json -Compress) }
$firmwareSettings = @(
  'board_manager:',
  '  additional_urls:',
  '    - https://espressif.github.io/arduino-esp32/package_esp32_index.json',
  'directories:',
  ('  data: ' + (ConvertTo-FirmwareYamlPath (Join-Path $firmwareTools 'data'))),
  ('  downloads: ' + (ConvertTo-FirmwareYamlPath (Join-Path $firmwareTools 'downloads'))),
  ('  user: ' + (ConvertTo-FirmwareYamlPath (Join-Path $firmwareTools 'user'))),
  'build_cache:',
  ('  path: ' + (ConvertTo-FirmwareYamlPath (Join-Path $firmwareTools 'build-cache'))),
  'updater:',
  '  enable_notification: false',
  'network:',
  '  connection_timeout: 120s'
)
Set-Content -LiteralPath $firmwareConfig -Value $firmwareSettings
& $firmwareCli version
if ($LASTEXITCODE -ne 0) { throw 'Workspace Arduino CLI failed to run' }
& $firmwareCli lib update-index --config-file $firmwareConfig
if ($LASTEXITCODE -ne 0) { throw 'Arduino library index download failed' }
& $firmwareCli lib install 'ArduinoJson@7.4.3' --config-file $firmwareConfig
if ($LASTEXITCODE -ne 0) { throw 'Pinned ArduinoJson installation failed' }
if ($InstallCore) {
  & $firmwareCli core update-index --config-file $firmwareConfig
  if ($LASTEXITCODE -ne 0) { throw 'ESP32 package index download failed' }
  & $firmwareCli core install 'esp32:esp32@3.3.12' --config-file $firmwareConfig
  if ($LASTEXITCODE -ne 0) { throw 'Pinned ESP32 core installation failed' }
}
Write-Output 'Firmware tools stay inside this workspace. No USB device was opened or flashed.'
