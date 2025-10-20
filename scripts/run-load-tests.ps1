# Script para executar testes de carga automatizados no Windows
# Testa diferentes arquiteturas (número de instâncias) e cargas (número de usuários)

$ErrorActionPreference = "Stop"

# Configurações dos testes
$ARCHITECTURES = @(1, 2, 3, 4)  # Número de instâncias do WordPress
$USER_LOADS = @(10, 100, 1000, 10000, 100000, 300000)  # Número de usuários simultâneos
$TEST_DURATION = 30  # Duração de cada teste em segundos
$SPAWN_RATE = 10  # Taxa de spawn (usuários por segundo)
$RESULTS_DIR = ".\results"

# Criar diretório de resultados
if (-not (Test-Path $RESULTS_DIR)) {
    New-Item -ItemType Directory -Path $RESULTS_DIR | Out-Null
}

Write-Host "========================================" -ForegroundColor Blue
Write-Host "INICIANDO TESTES DE CARGA AUTOMATIZADOS" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Arquiteturas a testar: " -NoNewline
Write-Host ($ARCHITECTURES -join ", ") -ForegroundColor Green
Write-Host " instâncias"
Write-Host "Cargas a testar: " -NoNewline
Write-Host ($USER_LOADS -join ", ") -ForegroundColor Green
Write-Host " usuários"
Write-Host "Duração de cada teste: " -NoNewline
Write-Host $TEST_DURATION -ForegroundColor Green
Write-Host " segundos"
Write-Host "Diretório de resultados: " -NoNewline
Write-Host $RESULTS_DIR -ForegroundColor Green
Write-Host ""

# Função para aguardar serviços estarem prontos
function Wait-ForServices {
    Write-Host "Aguardando serviços ficarem prontos..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30

    # Verificar se WordPress está respondendo
    $MAX_RETRIES = 30
    $RETRY_COUNT = 0

    while ($RETRY_COUNT -lt $MAX_RETRIES) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -in @(200, 301, 302)) {
                Write-Host "✓ WordPress está pronto!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            # Continuar tentando
        }

        $RETRY_COUNT++
        Write-Host "Tentativa $RETRY_COUNT/$MAX_RETRIES..."
        Start-Sleep -Seconds 5
    }

    Write-Host "✗ Timeout: WordPress não respondeu" -ForegroundColor Red
    return $false
}

# Função para executar um teste
function Run-Test {
    param(
        [int]$instances,
        [int]$users
    )

    $test_name = "arch${instances}_users${users}"
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $result_file = Join-Path $RESULTS_DIR "${test_name}_${timestamp}.csv.json"

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "TESTE: $instances instância(s) | $users usuários" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue

    # Escalar WordPress
    Write-Host "Escalando WordPress para $instances instância(s)..." -ForegroundColor Yellow
    docker-compose up -d --scale wordpress=$instances --no-recreate

    # Aguardar serviços estarem prontos
    if (-not (Wait-ForServices)) {
        Write-Host "✗ Falha ao iniciar serviços. Pulando teste." -ForegroundColor Red
        return
    }

    # Executar teste Locust via API
    Write-Host "Iniciando teste de carga com $users usuários..." -ForegroundColor Yellow

    # Iniciar teste (Locust API)
    try {
        $body = "user_count=$users&spawn_rate=$SPAWN_RATE"
        Invoke-RestMethod -Uri "http://localhost:8089/swarm" `
            -Method Post `
            -ContentType "application/x-www-form-urlencoded" `
            -Body $body | Out-Null

        Write-Host "✓ Teste iniciado!" -ForegroundColor Green
        Write-Host "Aguardando $TEST_DURATION segundos..." -ForegroundColor Yellow

        # Exibir progresso
        for ($i = 1; $i -le $TEST_DURATION; $i++) {
            Write-Host "`rProgresso: $i/$TEST_DURATION`s" -NoNewline
            Start-Sleep -Seconds 1
        }
        Write-Host ""

        # Coletar estatísticas
        Write-Host "Coletando estatísticas..." -ForegroundColor Yellow
        $stats = Invoke-RestMethod -Uri "http://localhost:8089/stats/requests"
        $stats | ConvertTo-Json -Depth 10 | Out-File -FilePath $result_file -Encoding UTF8

        # Parar teste
        Invoke-RestMethod -Uri "http://localhost:8089/stop" -Method Get | Out-Null

        Write-Host "✓ Teste concluído!" -ForegroundColor Green
        Write-Host "Resultados salvos em: " -NoNewline
        Write-Host $result_file -ForegroundColor Blue

        # Aguardar antes do próximo teste
        Start-Sleep -Seconds 10
    }
    catch {
        Write-Host "✗ Erro ao executar teste: $_" -ForegroundColor Red
    }
}

# Verificar se Locust está rodando
Write-Host "Verificando se Locust está ativo..." -ForegroundColor Yellow
$locustRunning = docker ps | Select-String "locust"

if (-not $locustRunning) {
    Write-Host "✗ Container Locust não está rodando!" -ForegroundColor Red
    Write-Host "Iniciando ambiente..." -ForegroundColor Yellow
    docker-compose up -d
    Wait-ForServices | Out-Null
}

Write-Host "✓ Locust está ativo!" -ForegroundColor Green
Write-Host ""

# Executar testes para cada combinação
$TOTAL_TESTS = $ARCHITECTURES.Count * $USER_LOADS.Count
$CURRENT_TEST = 0

Write-Host "Total de testes a executar: $TOTAL_TESTS" -ForegroundColor Blue
Write-Host ""

foreach ($arch in $ARCHITECTURES) {
    foreach ($users in $USER_LOADS) {
        $CURRENT_TEST++
        Write-Host "[$CURRENT_TEST/$TOTAL_TESTS]" -ForegroundColor Blue
        Run-Test -instances $arch -users $users
    }
}

# Gerar resumo
Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "TODOS OS TESTES CONCLUÍDOS!" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Total de testes executados: " -NoNewline
Write-Host $TOTAL_TESTS -ForegroundColor Green
Write-Host "Resultados salvos em: " -NoNewline
Write-Host $RESULTS_DIR -ForegroundColor Blue
Write-Host ""
Write-Host "Para analisar os resultados, você pode:" -ForegroundColor Yellow
Write-Host "1. Verificar os arquivos JSON em $RESULTS_DIR\"
Write-Host "2. Acessar o Locust: " -NoNewline
Write-Host "http://localhost:8089" -ForegroundColor Blue
Write-Host "3. Usar o script de análise: " -NoNewline
Write-Host ".\scripts\analyze-results.ps1" -ForegroundColor Green
Write-Host ""
