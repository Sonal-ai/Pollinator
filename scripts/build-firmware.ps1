param([switch]$Simulation)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$firmwareRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$firmwareCli = Join-Path $firmwareRoot '.local-tools/arduino/cli-1.5.1/arduino-cli.exe'
$firmwareConfig = Join-Path $firmwareRoot '.local-tools/arduino/arduino-cli.yaml'
if (-not (Test-Path -LiteralPath $firmwareCli) -or -not (Test-Path -LiteralPath $firmwareConfig)) {
  throw 'Run scripts/setup-firmware-tools.ps1 first.'
}
$firmwareMode = if ($Simulation) { 'simulation' } else { 'live' }
$firmwareBuild = Join-Path $firmwareRoot ".local-data/firmware-esp32/$firmwareMode"
$firmwareArguments = @('compile', '--profile', 'esp32', '--config-file', $firmwareConfig,
  '--build-path', $firmwareBuild, (Join-Path $firmwareRoot 'firmware/HoneyChainHive'))
if ($Simulation) { $firmwareArguments += @('--build-property', 'compiler.cpp.extra_flags=-DHC_SENSOR_SIMULATION=1') }
& $firmwareCli @firmwareArguments
if ($LASTEXITCODE -ne 0) { throw 'ESP32 firmware compilation failed.' }
Write-Output "Compiled $firmwareMode firmware. No USB device was opened or flashed."
