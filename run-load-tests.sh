#!/bin/bash
# Script para executar testes de carga automatizados
# Testa diferentes arquiteturas (número de instâncias) e cargas (número de usuários)

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações dos testes
ARCHITECTURES=(1 2 3 4)  # Número de instâncias do WordPress
USER_LOADS=(10 100 1000 10000 100000 300000)  # Número de usuários simultâneos
TEST_DURATION=30  # Duração de cada teste em segundos
SPAWN_RATE=10  # Taxa de spawn (usuários por segundo)
RESULTS_DIR="./results"

# Criar diretório de resultados
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}INICIANDO TESTES DE CARGA AUTOMATIZADOS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Arquiteturas a testar: ${GREEN}${ARCHITECTURES[@]}${NC} instâncias"
echo -e "Cargas a testar: ${GREEN}${USER_LOADS[@]}${NC} usuários"
echo -e "Duração de cada teste: ${GREEN}${TEST_DURATION}${NC} segundos"
echo -e "Diretório de resultados: ${GREEN}${RESULTS_DIR}${NC}"
echo ""

# Função para aguardar serviços estarem prontos
wait_for_services() {
    echo -e "${YELLOW}Aguardando serviços ficarem prontos...${NC}"
    sleep 30

    # Verificar se WordPress está respondendo
    MAX_RETRIES=30
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
            echo -e "${GREEN}✓ WordPress está pronto!${NC}"
            return 0
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -e "Tentativa $RETRY_COUNT/$MAX_RETRIES..."
        sleep 5
    done

    echo -e "${RED}✗ Timeout: WordPress não respondeu${NC}"
    return 1
}

# Função para executar um teste
run_test() {
    local instances=$1
    local users=$2
    local test_name="arch${instances}_users${users}"
    local result_file="${RESULTS_DIR}/${test_name}_$(date +%Y%m%d_%H%M%S).csv"

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}TESTE: ${instances} instância(s) | ${users} usuários${NC}"
    echo -e "${BLUE}========================================${NC}"

    # Escalar WordPress
    echo -e "${YELLOW}Escalando WordPress para ${instances} instância(s)...${NC}"
    docker-compose up -d --scale wordpress=$instances --no-recreate

    # Aguardar serviços estarem prontos
    wait_for_services

    # Executar teste Locust via API
    echo -e "${YELLOW}Iniciando teste de carga com ${users} usuários...${NC}"

    # Iniciar teste (Locust API)
    curl -s -X POST http://localhost:8089/swarm \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "user_count=${users}&spawn_rate=${SPAWN_RATE}" > /dev/null

    echo -e "${GREEN}✓ Teste iniciado!${NC}"
    echo -e "${YELLOW}Aguardando ${TEST_DURATION} segundos...${NC}"

    # Exibir progresso
    for i in $(seq 1 $TEST_DURATION); do
        echo -ne "Progresso: ${i}/${TEST_DURATION}s\r"
        sleep 1
    done
    echo ""

    # Coletar estatísticas
    echo -e "${YELLOW}Coletando estatísticas...${NC}"
    curl -s http://localhost:8089/stats/requests > "${result_file}.json"

    # Parar teste
    curl -s -X GET http://localhost:8089/stop > /dev/null

    echo -e "${GREEN}✓ Teste concluído!${NC}"
    echo -e "Resultados salvos em: ${BLUE}${result_file}.json${NC}"

    # Aguardar antes do próximo teste
    sleep 10
}

# Verificar se Locust está rodando
echo -e "${YELLOW}Verificando se Locust está ativo...${NC}"
if ! docker ps | grep -q "locust"; then
    echo -e "${RED}✗ Container Locust não está rodando!${NC}"
    echo -e "${YELLOW}Iniciando ambiente...${NC}"
    docker-compose up -d
    wait_for_services
fi

echo -e "${GREEN}✓ Locust está ativo!${NC}"
echo ""

# Executar testes para cada combinação
TOTAL_TESTS=$((${#ARCHITECTURES[@]} * ${#USER_LOADS[@]}))
CURRENT_TEST=0

echo -e "${BLUE}Total de testes a executar: ${TOTAL_TESTS}${NC}"
echo ""

for arch in "${ARCHITECTURES[@]}"; do
    for users in "${USER_LOADS[@]}"; do
        CURRENT_TEST=$((CURRENT_TEST + 1))
        echo -e "${BLUE}[${CURRENT_TEST}/${TOTAL_TESTS}]${NC}"
        run_test $arch $users
    done
done

# Gerar resumo
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TODOS OS TESTES CONCLUÍDOS!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total de testes executados: ${GREEN}${TOTAL_TESTS}${NC}"
echo -e "Resultados salvos em: ${BLUE}${RESULTS_DIR}/${NC}"
echo ""
echo -e "${YELLOW}Para analisar os resultados, você pode:${NC}"
echo -e "1. Verificar os arquivos JSON em ${RESULTS_DIR}/"
echo -e "2. Acessar o Locust: ${BLUE}http://localhost:8089${NC}"
echo -e "3. Usar o script de análise: ${GREEN}./analyze-results.sh${NC}"
echo ""
