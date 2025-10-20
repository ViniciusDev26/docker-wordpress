# Script para analisar os resultados dos testes de carga no Windows

$ErrorActionPreference = "Stop"

$RESULTS_DIR = ".\results"
$REPORT_FILE = Join-Path $RESULTS_DIR "summary_report.md"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "ANÁLISE DE RESULTADOS - TESTES DE CARGA" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Verificar se existem resultados
if (-not (Test-Path $RESULTS_DIR) -or
    -not (Get-ChildItem -Path $RESULTS_DIR -Filter "*.json" -ErrorAction SilentlyContinue)) {
    Write-Host "Nenhum resultado encontrado em $RESULTS_DIR/" -ForegroundColor Yellow
    Write-Host "Execute primeiro: .\scripts\run-load-tests.ps1"
    exit 1
}

# Criar relatório em Markdown
$timestamp = Get-Date -Format "dd/MM/yyyy HH:mm:ss"

$reportHeader = @"
# Relatório de Testes de Carga

**Data:** $timestamp

## Resultados dos Testes

| Teste | Instâncias | Usuários | REQ/S | Falhas (%) |
|-------|-----------|----------|-------|-----------|
"@

Set-Content -Path $REPORT_FILE -Value $reportHeader -Encoding UTF8

Write-Host "Analisando resultados..." -ForegroundColor Green
Write-Host ""

# Cabeçalho da tabela para console
$headerFormat = "{0,-40} | {1,-10} | {2,-15} | {3,-15} | {4,-12}"
Write-Host ($headerFormat -f "TESTE", "INSTÂNCIAS", "USUÁRIOS", "REQ/S", "FALHAS (%)") -ForegroundColor Cyan
Write-Host ("-" * 100)

# Processar cada arquivo JSON
$jsonFiles = Get-ChildItem -Path $RESULTS_DIR -Filter "*.json" | Sort-Object Name

foreach ($file in $jsonFiles) {
    $filename = $file.Name

    # Extrair informações do nome do arquivo
    if ($filename -match "arch(\d+)_users(\d+)") {
        $instances = $matches[1]
        $users = $matches[2]

        try {
            # Ler e processar JSON
            $data = Get-Content $file.FullName -Raw | ConvertFrom-Json

            if ($data.stats -and $data.stats.Count -gt 0) {
                $totalRps = [math]::Round($data.stats[0].total_rps, 2)
                $failRatio = [math]::Round($data.stats[0].fail_ratio * 100, 2)
            }
            else {
                $totalRps = 0
                $failRatio = 0
            }

            # Formatar e exibir no console
            Write-Host ($headerFormat -f $filename, $instances, $users, $totalRps, "$failRatio%")

            # Adicionar ao relatório Markdown
            $mdLine = "| $filename | $instances | $users | $totalRps | $failRatio% |"
            Add-Content -Path $REPORT_FILE -Value $mdLine -Encoding UTF8
        }
        catch {
            Write-Host "Erro ao processar $filename : $_" -ForegroundColor Red
        }
    }
}

# Adicionar rodapé ao relatório Markdown
$reportFooter = @"

## Observações

- **REQ/S**: Requisições por segundo
- **Falhas**: Percentual de requisições que falharam

## Recursos

- Interface do Locust: [http://localhost:8089](http://localhost:8089)
- Arquivos JSON detalhados disponíveis em: ``.\results\``

---

*Relatório gerado automaticamente pelo script analyze-results.ps1*
"@

Add-Content -Path $REPORT_FILE -Value $reportFooter -Encoding UTF8

Write-Host ""
Write-Host "✓ Análise concluída!" -ForegroundColor Green
Write-Host "Relatório salvo em: " -NoNewline
Write-Host $REPORT_FILE -ForegroundColor Blue
Write-Host ""
Write-Host "Dica: " -NoNewline -ForegroundColor Yellow
Write-Host "Para visualizar gráficos detalhados, acesse: " -NoNewline
Write-Host "http://localhost:8089" -ForegroundColor Blue
Write-Host ""
