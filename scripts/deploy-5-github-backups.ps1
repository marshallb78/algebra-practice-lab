$ErrorActionPreference = 'Stop'

# 5 clean backup repo names (no "matthew" or "clicker")
$repos = @(
  'study-notes-hub',
  'algebra-practice-lab',
  'earth-science-atlas',
  'vocab-builder-app',
  'geometry-toolkit'
)

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Please run 'gh auth login' first, then re-run this script."
  exit 1
}

$owner = (gh api user --jq '.login').Trim()
if (-not $owner) {
  Write-Error "Could not determine GitHub username from gh CLI."
  exit 1
}

foreach ($repo in $repos) {
  $full = "$owner/$repo"
  Write-Host "`n=== Setting up $full ===" -ForegroundColor Cyan

  gh repo view $full *> $null
  if ($LASTEXITCODE -ne 0) {
    gh repo create $full --public --description "Interactive study web app"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  # Push current main branch to this backup repo
  $remoteUrl = "https://github.com/$full.git"
  git push $remoteUrl HEAD:refs/heads/main --force
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # Enable GitHub Pages with GitHub Actions workflow build
  gh api -X POST "repos/$full/pages" -f build_type=workflow *> $null
  if ($LASTEXITCODE -ne 0) {
    gh api -X PUT "repos/$full/pages" -f build_type=workflow *> $null
  }

  Write-Host "Backup URL: https://$owner.github.io/$repo/" -ForegroundColor Green
}

Write-Host "`nAll 5 GitHub Pages backups pushed! Give GitHub Actions ~1-2 minutes to finish deploying each site." -ForegroundColor Yellow
