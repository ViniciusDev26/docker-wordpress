#!/bin/bash
# Script manual para inicializar o WordPress com posts de teste
# Uso: ./scripts/init-wp.sh

set -e

echo "=========================================="
echo "Inicializando WordPress com posts de teste"
echo "=========================================="

# Verifica se os containers estão rodando
if ! docker-compose ps wordpress | grep -q "Up"; then
    echo "❌ Erro: O serviço 'wordpress' não está rodando."
    echo "Execute primeiro: docker-compose up -d"
    exit 1
fi

if ! docker-compose ps db | grep -q "Up"; then
    echo "❌ Erro: O serviço 'db' não está rodando."
    echo "Execute primeiro: docker-compose up -d"
    exit 1
fi

echo "✓ Containers estão rodando"
echo ""
echo "Executando script de inicialização no container..."
echo ""

# Executa o script de inicialização dentro do container wordpress
docker-compose exec -T wordpress bash /usr/local/bin/init-wordpress.sh

echo ""
echo "=========================================="
echo "✓ Inicialização concluída!"
echo "=========================================="
