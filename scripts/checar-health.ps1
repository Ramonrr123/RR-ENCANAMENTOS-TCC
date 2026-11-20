# Confere GET /health (leve, sem banco) e GET /health/db.
# Não há suite Nest/Jest neste repositório; este script cobre a checagem manual automatizada.
# Não imprime connection string nem segredos.

$ErrorActionPreference = 'Stop'

function Sair([string]$mensagem, [int]$codigo = 1) {
  Write-Host $mensagem
  exit $codigo
}

$base = $env:API_BASE_URL
if ([string]::IsNullOrWhiteSpace($base)) {
  $base = 'http://localhost:3000'
}
$base = $base.TrimEnd('/')

Write-Host "Base: $base"
Write-Host ""

try {
  $health = Invoke-WebRequest -Uri "$base/health" -Method GET -UseBasicParsing
} catch {
  Sair "Falha ao chamar GET /health. Suba a API e tente de novo. $($_.Exception.Message)"
}

if ($health.StatusCode -ne 200) {
  Sair "GET /health deveria responder 200. Status: $($health.StatusCode)"
}

$corpoHealth = $health.Content | ConvertFrom-Json
if ($corpoHealth.status -ne 'ok') {
  Sair "GET /health deveria ter status ok."
}

Write-Host "GET /health -> $($health.StatusCode) status=$($corpoHealth.status)"

try {
  $db = Invoke-WebRequest -Uri "$base/health/db" -Method GET -UseBasicParsing
  $corpoDb = $db.Content | ConvertFrom-Json
  Write-Host "GET /health/db -> $($db.StatusCode) status=$($corpoDb.status) database=$($corpoDb.database)"
  if ($db.StatusCode -ne 200) {
    Sair "Com o banco no ar, GET /health/db deveria responder 200."
  }
} catch {
  $resposta = $_.Exception.Response
  if ($null -eq $resposta) {
    Sair "Falha ao chamar GET /health/db. $($_.Exception.Message)"
  }
  $codigo = [int]$resposta.StatusCode
  Write-Host "GET /health/db -> $codigo (banco indisponivel ou timeout)"
  if ($codigo -ne 503) {
    Sair "Esperado 503 quando o banco falha. Status: $codigo"
  }
  Write-Host "Simulacao de falha do banco confirmada (503)."
  Write-Host ""
  Write-Host "Como simular de novo:"
  Write-Host "  1. Pare o PostgreSQL local, ou pause o projeto no painel do Supabase."
  Write-Host "  2. Ou reinicie a API com DATABASE_URL apontando para uma porta fechada."
  Write-Host "  3. Rode este script de novo: GET /health continua 200; GET /health/db deve ser 503."
  exit 0
}

Write-Host ""
Write-Host "Como simular banco fora (para ver 503 em /health/db):"
Write-Host "  1. Pare o PostgreSQL local, ou pause o projeto no painel do Supabase."
Write-Host "  2. Ou reinicie a API com DATABASE_URL apontando para uma porta fechada."
Write-Host "  3. Rode este script de novo: GET /health continua 200; GET /health/db deve ser 503."
Write-Host "  Variavel opcional: API_BASE_URL (padrao http://localhost:3000)."
exit 0
