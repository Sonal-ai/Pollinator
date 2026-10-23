# Manual recovery when command approval is unavailable. Stops only this project's labelled QA services.
# Preserves containers, volumes, images, databases and private configuration for later inspection.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$qaProjects = @('honeychain-qa-cluster-a', 'honeychain-qa-cluster-b', 'honeychain-qa2-cluster-a', 'honeychain-qa2-cluster-b', 'honeychain-restore-qa-cluster-a')
Push-Location -LiteralPath $taskRoot
try {
  foreach ($qaProject in $qaProjects) {
    $qaIds = @(podman ps -q --filter "label=io.podman.compose.project=$qaProject")
    foreach ($qaId in $qaIds) {
      if ($qaId -notmatch '^[a-f0-9]{12,64}$') { throw 'Unexpected QA container ID' }
      $qaInfo = @(podman inspect $qaId | ConvertFrom-Json)[0]
      if ($qaInfo.Config.Labels.'io.podman.compose.project' -ne $qaProject) { throw 'Container ownership changed; refusing to stop it' }
      podman stop $qaId
      if ($LASTEXITCODE -ne 0) { throw 'A QA container could not be stopped' }
    }
  }
  podman container exists honeychain-qa-evm
  if ($LASTEXITCODE -eq 0) {
    $evmInfo = @(podman inspect honeychain-qa-evm | ConvertFrom-Json)[0]
    if ($evmInfo.Config.Labels.'io.honeychain.qa' -ne 'cluster-release') { throw 'The EVM container is not the project QA fixture' }
    if ($evmInfo.State.Running) { podman stop $evmInfo.Id }
  }
  $pgState = node scripts/local-postgres.cjs status
  if ($pgState -match 'Project PostgreSQL is running') { node scripts/local-postgres.cjs stop }
  $remaining = @(podman ps -q)
  if ($remaining.Count -eq 0) {
    # This machine was stopped before this task started it. Do not stop it if unrelated containers now run.
    podman machine stop podman-machine-default
  } else { Write-Output 'Podman remains running because other containers are active.' }
  Write-Output 'Project QA shutdown complete; all stored data and images were preserved.'
} finally { Pop-Location }
