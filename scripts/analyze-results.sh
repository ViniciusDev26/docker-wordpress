#!/bin/bash
# Script para analisar os resultados dos testes de carga

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESULTS_DIR="./results"
REPORT_FILE="${RESULTS_DIR}/summary_report.md"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ANÁLISE DE RESULTADOS - TESTES DE CARGA${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar se existem resultados
if [ ! -d "$RESULTS_DIR" ] || [ -z "$(ls -A $RESULTS_DIR/*.json 2>/dev/null)" ]; then
    echo -e "${YELLOW}Nenhum resultado encontrado em ${RESULTS_DIR}/${NC}"
    echo "Execute primeiro: ./scripts/run-load-tests.sh"
    exit 1
fi

# Criar relatório em Markdown
cat > "$REPORT_FILE" << EOF
# Relatório de Testes de Carga

**Data:** $(date '+%d/%m/%Y %H:%M:%S')

## Resultados dos Testes

| Teste | Instâncias | Usuários | REQ/S | Falhas (%) |
|-------|-----------|----------|-------|-----------|
EOF

echo -e "${GREEN}Analisando resultados...${NC}"
echo ""

# Cabeçalho da tabela para console
printf "%-20s | %-10s | %-15s | %-15s | %-10s\n" \
    "TESTE" "INSTÂNCIAS" "USUÁRIOS" "REQ/S" "FALHAS (%)"
echo "--------------------------------------------------------------------------------"

# Processar cada arquivo JSON
for file in $RESULTS_DIR/*.json; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")

        # Extrair informações do nome do arquivo
        if [[ $filename =~ arch([0-9]+)_users([0-9]+) ]]; then
            instances="${BASH_REMATCH[1]}"
            users="${BASH_REMATCH[2]}"

            # Extrair métricas do JSON usando jq ou python
            if command -v jq &> /dev/null; then
                total_rps=$(jq -r '.stats[0].total_rps // 0' "$file")
                fail_ratio=$(jq -r '.stats[0].fail_ratio // 0' "$file")
                fail_percentage=$(echo "$fail_ratio * 100" | bc -l 2>/dev/null || echo "0")
            elif command -v python3 &> /dev/null; then
                metrics=$(python3 -c "
import json
with open('$file') as f:
    data = json.load(f)
    if 'stats' in data and len(data['stats']) > 0:
        print(f\"{data['stats'][0].get('total_rps', 0):.2f} {data['stats'][0].get('fail_ratio', 0)*100:.2f}\")
    else:
        print('0 0')
" 2>/dev/null || echo "0 0")
                total_rps=$(echo $metrics | cut -d' ' -f1)
                fail_percentage=$(echo $metrics | cut -d' ' -f2)
            else
                total_rps="N/A"
                fail_percentage="N/A"
            fi

            # Formatar e exibir no console
            printf "%-20s | %-10s | %-15s | %-15s | %-10s\n" \
                "$filename" "$instances" "$users" "$total_rps" "$fail_percentage%"

            # Adicionar ao relatório Markdown
            echo "| $filename | $instances | $users | $total_rps | $fail_percentage% |" >> "$REPORT_FILE"
        fi
    fi
done

# Adicionar rodapé ao relatório Markdown
cat >> "$REPORT_FILE" << EOF

## Observações

- **REQ/S**: Requisições por segundo
- **Falhas**: Percentual de requisições que falharam

## Recursos

- Interface do Locust: [http://localhost:8089](http://localhost:8089)
- Arquivos JSON detalhados disponíveis em: \`./results/\`

---

*Relatório gerado automaticamente pelo script analyze-results.sh*
EOF

echo ""
echo -e "${GREEN}✓ Análise concluída!${NC}"
echo -e "${BLUE}Relatório salvo em: ${REPORT_FILE}${NC}"
echo ""
echo -e "${YELLOW}Dica:${NC} Para visualizar gráficos detalhados, acesse: ${BLUE}http://localhost:8089${NC}"
echo ""
