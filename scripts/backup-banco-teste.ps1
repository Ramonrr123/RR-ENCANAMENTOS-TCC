# Dump do PostgreSQL LOCAL de teste.
# Lê a conexão só da variável de ambiente DATABASE_URL.
# Não grava senha neste arquivo e não imprime a connection string.
# Recusa qualquer host que não seja localhost.

$ErrorActionPreference = 'Stop'

function Sair([string]$mensagem) {
  Write-Host $mensagem
  exit 1
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  Sair "pg_dump não foi encontrado no PATH. Instale o cliente do PostgreSQL e tente de novo."
}

$conexao = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($conexao)) {
  Sair "A variável de ambiente DATABASE_URL não está definida. Defina-a com o banco local antes de executar. Nenhum dump foi feito."
}

try {
  $uri = [System.Uri]$conexao
} catch {
  Sair "DATABASE_URL não pôde ser lida como endereço. Nada foi executado."
}

$hostsLocais = @('localhost', '127.0.0.1', '::1')
if ($hostsLocais -notcontains $uri.Host) {
  Sair "Este script só faz dump do banco local (localhost). O host de DATABASE_URL não é local. Nenhum dump foi executado."
}

$usuario = ''
$senha = ''
if ($uri.UserInfo -match '^(?<usuario>[^:]*):(?<senha>.*)$') {
  $usuario = [Uri]::UnescapeDataString($Matches['usuario'])
  $senha = [Uri]::UnescapeDataString($Matches['senha'])
} elseif (-not [string]::IsNullOrWhiteSpace($uri.UserInfo)) {
  $usuario = [Uri]::UnescapeDataString($uri.UserInfo)
}

$banco = $uri.AbsolutePath.TrimStart('/')
if ([string]::IsNullOrWhiteSpace($banco)) {
  Sair "DATABASE_URL não informa o nome do banco. Nada foi executado."
}

$porta = if ($uri.Port -gt 0) { [string]$uri.Port } else { '5432' }

$pasta = Join-Path (Split-Path -Parent $PSScriptRoot) 'backups'
if (-not (Test-Path -LiteralPath $pasta)) {
  New-Item -ItemType Directory -Path $pasta | Out-Null
}

$arquivo = Join-Path $pasta ('banco-teste-{0:yyyyMMdd-HHmmss}.sql' -f (Get-Date))

$env:PGHOST = $uri.Host
$env:PGPORT = $porta
$env:PGUSER = $usuario
$env:PGPASSWORD = $senha
$env:PGDATABASE = $banco

& $pgDump.Source --format=plain --no-owner --file=$arquivo
if ($LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $arquivo) {
    Remove-Item -LiteralPath $arquivo -Force
  }
  Sair "pg_dump falhou ao gravar o dump local. Confira se o PostgreSQL local está no ar. A connection string não foi impressa."
}

Write-Host "Dump local gravado."
Write-Host $arquivo
exit 0
