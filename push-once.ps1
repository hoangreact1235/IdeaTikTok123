param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl,

  [string]$Branch = 'main',
  [string]$CommitMessage = 'Initial deploy-ready version'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git CLI chua duoc cai dat. Hay cai Git for Windows truoc, sau do chay lai script.'
}

if (-not (Test-Path '.git')) {
  git init
}

if (-not (git config user.name)) {
  throw 'Chua co git user.name. Chay: git config --global user.name "Ten cua ban"'
}

if (-not (git config user.email)) {
  throw 'Chua co git user.email. Chay: git config --global user.email "email@ban.com"'
}

git add .

$stagedFiles = git diff --cached --name-only
if (-not $stagedFiles) {
  Write-Host 'Khong co thay doi nao de push.' -ForegroundColor Yellow
  exit 0
}

$potentialSecretFiles = $stagedFiles | Where-Object { $_ -match '(^|/)\.env($|\.|/)' }
if ($potentialSecretFiles) {
  Write-Host 'Phat hien file .env dang duoc stage. Da dung de tranh lo API key:' -ForegroundColor Red
  $potentialSecretFiles | ForEach-Object { Write-Host " - $_" }
  throw 'Bo file .env khoi stage roi chay lai.'
}

git commit -m $CommitMessage

$originExists = $true
try {
  $null = git remote get-url origin
} catch {
  $originExists = $false
}

if ($originExists) {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

git branch -M $Branch
git push -u origin $Branch

Write-Host 'Push hoan tat.' -ForegroundColor Green
