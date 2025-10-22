# Testes de Carga no WordPress com Locust

Este projeto configura um ambiente WordPress com Docker e realiza testes de carga automatizados usando o Locust para avaliar o desempenho em diferentes cenários.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Pré-requisitos](#pré-requisitos)
- [Arquitetura do Projeto](#arquitetura-do-projeto)
- [Instalação e Configuração](#instalação-e-configuração)
- [Executando os Testes](#executando-os-testes)
- [Analisando Resultados](#analisando-resultados)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Cenários de Teste](#cenários-de-teste)
- [Personalização](#personalização)
- [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

Este projeto automatiza a execução de testes de carga no WordPress, variando:

- **Arquitetura**: 1, 2 e 3 instâncias do WordPress (escalabilidade horizontal)
- **Carga de usuários**: 10, 100 e 1000 usuários simultâneos (crescente)
- **Duração**: Cada teste executa por 30 segundos
- **Total de testes**: 9 combinações (3 arquiteturas × 3 cargas)
- **Visualização**: Gráficos interativos com métricas de desempenho

### Posts de Teste

O WordPress é automaticamente configurado com 3 posts específicos:

1. **Post com Imagem 1MB** - Testa carregamento de imagens pesadas
2. **Post com Texto 400KB** - Testa processamento de conteúdo textual grande
3. **Post com Imagem 300KB** - Testa carregamento de imagens médias

## 🔧 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Docker** (versão 20.10 ou superior)

  ```bash
  docker --version
  ```

- **Docker Compose** (versão 1.29 ou superior)

  ```bash
  docker-compose --version
  ```

- **Bun** (runtime JavaScript/TypeScript)

  ```bash
  bun --version
  ```

  Para instalar o Bun:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **curl** (para verificação de serviços e API do Locust)

  ```bash
  curl --version
  ```

### Requisitos de Sistema

- **RAM**: Mínimo 4GB (recomendado 8GB+)
- **Espaço em disco**: ~2GB livres
- **Portas disponíveis**: 80 (HTTP), 8089 (Locust)

## 🏗️ Arquitetura do Projeto

```text
┌─────────────┐
│   Locust    │ (Gerador de carga - porta 8089)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Nginx    │ (Load Balancer - porta 80)
└──────┬──────┘
       │
       ├────────────┬────────────┬────────────┐
       ▼            ▼            ▼            ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│WordPress 1│ │WordPress 2│ │WordPress 3│ │WordPress 4│
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │
      └─────────────┴─────────────┴─────────────┘
                    │
                    ▼
              ┌──────────┐
              │  MySQL   │ (Banco de dados)
              └──────────┘
```

## 📦 Instalação e Configuração

### Passo 1: Clonar/Acessar o Projeto

```bash
cd /caminho/para/docker-wordpress
```

### Passo 2: Verificar Arquivos

Certifique-se de que os seguintes arquivos existem:

```text
docker-wordpress/
├── docker-compose.yml          # Configuração dos containers
├── Dockerfile.wordpress        # Imagem customizada do WordPress (com Bun)
├── nginx.conf                  # Configuração do load balancer
├── package.json                # Dependências e scripts NPM
└── scripts/                    # Diretório de scripts
    ├── init-wordpress.ts       # Script de inicialização (Bun/TypeScript)
    ├── locustfile.py           # Cenários de teste do Locust
    ├── run-load-tests.ts       # Script principal de testes (Bun/TypeScript)
    └── analyze-results.ts      # Script de análise (Bun/TypeScript)
```

### Passo 3: Instalar Dependências

```bash
bun install
```

### Passo 4: Build das Imagens Docker

Este passo pode levar alguns minutos na primeira vez:

```bash
docker-compose build
```

**O que acontece:**

- Download da imagem base do WordPress
- Instalação do ImageMagick (para gerar imagens)
- Instalação do WP-CLI (para automatizar configurações)
- **Instalação do Bun** (runtime TypeScript/JavaScript)
- Build da imagem customizada

### Passo 5: Iniciar o Ambiente

```bash
docker-compose up -d
```

**Containers iniciados:**

- `wordpress` - Aplicação WordPress
- `db` - Banco de dados MySQL
- `nginx` - Load balancer
- `locust` - Gerador de carga

### Passo 6: Inicializar WordPress com Posts de Teste

Execute o script de inicialização dentro do container WordPress:

```bash
docker-compose exec wordpress bun /usr/local/bin/init-wordpress.ts
```

**Aguarde até ver:**

```text
========================================
WordPress configurado com sucesso!
========================================
URL: http://localhost
Usuário: admin
Senha: admin123
========================================
Posts criados:
1. /post-imagem-1mb/ - Post com imagem de 1MB
2. /post-texto-400kb/ - Post com texto de 400KB
3. /post-imagem-300kb/ - Post com imagem de 300KB
========================================
```

### Passo 7: Verificar o WordPress

Acesse no navegador: <http://localhost>

Você deverá ver o WordPress funcionando com os 3 posts criados.

**Login no admin:**

- URL: <http://localhost/wp-admin>
- Usuário: `admin`
- Senha: `admin123`

## 🚀 Executando os Testes

### Opção 1: Testes Automatizados (Recomendado)

Execute todos os 24 testes automaticamente usando Bun:

```bash
bun run test:load
```

Ou diretamente:

```bash
bun scripts/run-load-tests.ts
```

**O que acontece:**

1. Script verifica se o ambiente está rodando
2. Para cada combinação de arquitetura + carga:
   - Escala o WordPress para N instâncias
   - Aguarda serviços estarem prontos
   - Inicia teste com M usuários
   - Executa por 10 segundos
   - Coleta estatísticas
   - Salva resultados em `results/`
   - Aguarda 10s antes do próximo teste

**Duração estimada:** ~10 minutos (24 testes × ~25s cada)

**Progresso no terminal:**

```text
========================================
[1/24]
========================================
TESTE: 1 instância(s) | 10 usuários
========================================
✓ WordPress está pronto!
✓ Teste iniciado!
Progresso: 10/10s
✓ Teste concluído!
```

### Opção 2: Testes Manuais via Interface Web

1. Acesse o Locust: <http://localhost:8089>

2. Configure o teste:
   - **Number of users**: 100
   - **Spawn rate**: 10
   - **Host**: <http://nginx>

3. Clique em **Start swarming**

4. Acompanhe em tempo real:
   - Gráficos de requisições/segundo
   - Tempo de resposta
   - Taxa de falhas

5. Para o teste: clique em **Stop**

### Opção 3: Testar Arquitetura Específica

Escalar manualmente o WordPress:

```bash
# 2 instâncias
docker-compose up -d --scale wordpress=2

# 3 instâncias
docker-compose up -d --scale wordpress=3

# 4 instâncias
docker-compose up -d --scale wordpress=4

# Voltar para 1 instância
docker-compose up -d --scale wordpress=1
```

Depois acesse o Locust (<http://localhost:8089>) e configure manualmente.

## 📊 Analisando Resultados

### Gerar Relatório Resumido

Execute o script de análise usando Bun:

```bash
bun run analyze
```

Ou diretamente:

```bash
bun scripts/analyze-results.ts
```

**Saída no terminal:**

```text
========================================
ANÁLISE DE RESULTADOS - TESTES DE CARGA
========================================

Analisando resultados...

TESTE                | INSTÂNCIAS | USUÁRIOS        | REQ/S           | FALHAS (%)
--------------------------------------------------------------------------------
arch1_users10...     | 1          | 10              | 45.32           | 0.00%
arch1_users50...     | 1          | 50              | 120.45          | 2.34%
...

✓ Análise concluída!
Relatório salvo em: results/summary_report.md
```

### Gerar Gráficos Interativos

Após executar os testes, gere um relatório HTML com gráficos:

```bash
bun run report
```

Isso criará um arquivo `results/report.html` com gráficos interativos mostrando:

**Gráficos por Número de Usuários (eixo X = usuários):**
- Requisições por Segundo vs Usuários
- Tempo de Resposta Médio vs Usuários
- Taxa de Falhas vs Usuários

**Gráficos por Número de Instâncias (eixo X = instâncias):**
- Requisições por Segundo vs Instâncias
- Tempo de Resposta Médio vs Instâncias
- Taxa de Falhas vs Instâncias

Abra o relatório no navegador:

```bash
open results/report.html
# ou
xdg-open results/report.html
```

### Visualizar Relatório Markdown

```bash
cat results/summary_report.md
```

### Estrutura do Relatório

O relatório `summary_report.md` contém:

- Data e hora da análise
- Tabela com todos os resultados:
  - Nome do teste
  - Número de instâncias
  - Número de usuários
  - Requisições por segundo (REQ/S)
  - Taxa de falhas (%)
- Observações e recursos

### Arquivos JSON Detalhados

Cada teste gera um arquivo JSON em `results/` com métricas detalhadas:

```bash
ls -lh results/

# Exemplo:
arch1_users10_20251020_153045.csv.json
arch1_users50_20251020_153120.csv.json
...
```

**Conteúdo do JSON:**

- Estatísticas por endpoint
- Tempo de resposta (média, mediana, min, max, percentis)
- Número total de requisições
- Taxa de falhas
- Requisições por segundo

### Visualizar JSON

```bash
cat results/arch1_users10_*.json | python3 -m json.tool
# ou
cat results/arch1_users10_*.json | jq
```

## 📁 Estrutura de Arquivos

```text
docker-wordpress/
│
├── docker-compose.yml          # Orquestração dos containers
├── Dockerfile.wordpress        # Build da imagem customizada
├── nginx.conf                  # Configuração do load balancer
│
├── scripts/                    # Scripts de automação
│   ├── init-wordpress.ts       # Script de inicialização (Bun/TypeScript)
│   ├── locustfile.py           # Cenários de teste do Locust
│   ├── run-load-tests.ts       # Automação dos testes (Bun/TypeScript)
│   └── analyze-results.ts      # Análise de resultados (Bun/TypeScript)
│
├── .gitignore                  # Ignora wp-content/ e results/
├── README.md                   # Esta documentação
│
├── wp-content/                 # Conteúdo do WordPress (gerado)
│   ├── uploads/                # Imagens dos posts
│   ├── themes/
│   └── plugins/
│
└── results/                    # Resultados dos testes (gerado)
    ├── arch1_users10_*.json
    ├── arch1_users50_*.json
    └── summary_report.md
```

## 🎭 Cenários de Teste

### WordPressUser (Usuário Normal)

Simula um visitante comum do blog com os seguintes comportamentos:

| Tarefa | Peso | Descrição |
|--------|------|-----------|
| `view_post_large_image` | 3 | Acessa post com imagem de 1MB |
| `view_post_large_text` | 3 | Acessa post com texto de 400KB |
| `view_post_medium_image` | 3 | Acessa post com imagem de 300KB |
| `view_homepage` | 2 | Acessa a página inicial |
| `view_all_posts_sequence` | 1 | Navega pelos 3 posts em sequência |

**Tempo de espera:** 1-3 segundos entre requisições

### WordPressHeavyUser (Usuário Intensivo)

Simula um usuário mais agressivo (bots, scrapers):

| Tarefa | Peso | Descrição |
|--------|------|-----------|
| `rapid_post_access` | 5 | Acessa os 3 posts rapidamente |
| `load_homepage_and_posts` | 2 | Carrega homepage + todos os posts |

**Tempo de espera:** 0.5-1.5 segundos entre requisições

### Como o Locust Escolhe as Tarefas

O peso determina a probabilidade:

- Peso 3 = 3x mais provável que peso 1
- Peso 5 = 5x mais provável que peso 1

Exemplo com `WordPressUser`:

- Total de pesos: 3+3+3+2+1 = 12
- `view_post_large_image`: 3/12 = 25%
- `view_homepage`: 2/12 = 16.7%
- `view_all_posts_sequence`: 1/12 = 8.3%

## ⚙️ Personalização

### Modificar Configurações dos Testes

Edite `scripts/run-load-tests.ts`:

```typescript
const config = {
  architectures: [1, 2, 3, 4], // Número de instâncias do WordPress
  userLoads: [10, 100, 1000, 10000, 100000, 300000], // Número de usuários
  testDuration: 30, // Duração de cada teste em segundos
  spawnRate: 10, // Taxa de spawn (usuários por segundo)
  resultsDir: './results',
};
```


### Adicionar Novos Cenários de Teste

Edite `scripts/locustfile.py`:

```python
@task(2)
def new_test(self):
    """
    Descrição do novo teste
    Peso 2: moderado
    """
    self.client.get("/novo-endpoint/", name="Novo Teste")
```

### Modificar Posts de Teste

Edite `scripts/init-wordpress.sh` para alterar:

- Tamanho das imagens
- Quantidade de texto
- Slugs dos posts
- Outros posts adicionais

### Alterar Versão do WordPress

Edite `Dockerfile.wordpress`:

```dockerfile
FROM wordpress:6.4-php8.2-apache
```

**Atenção:** Versões diferentes podem requerer ajustes nos repositórios APT.

## 🔍 Troubleshooting

### Problema: Porta 80 já está em uso

**Erro:**

```text
Error starting userland proxy: listen tcp4 0.0.0.0:80: bind: address already in use
```

**Solução:**

```bash
# Descobrir o que está usando a porta 80
sudo lsof -i :80

# Parar o serviço (exemplo: Apache)
sudo systemctl stop apache2
# ou
sudo apachectl stop

# Ou modificar a porta no docker-compose.yml
ports:
  - "8080:80"  # Usar porta 8080 ao invés de 80
```

### Problema: Containers não iniciam

**Erro:**

```text
ERROR: Service 'wordpress' failed to build
```

**Solução:**

```bash
# Limpar containers e imagens antigas
docker-compose down -v
docker system prune -a

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Problema: WordPress não responde

**Sintoma:** Script fica em loop aguardando WordPress

**Solução:**

```bash
# Verificar logs
docker-compose logs wordpress
docker-compose logs db

# Verificar se MySQL está saudável
docker-compose ps

# Se necessário, reiniciar
docker-compose restart wordpress db
```

### Problema: Posts não foram criados

**Sintoma:** Locust retorna 404 para os posts

**Solução:**

```bash
# Verificar logs do wp-init
docker-compose logs wp-init

# Reexecutar inicialização
docker-compose restart wp-init

# Ou executar manualmente
docker-compose exec wordpress bash
wp post list --allow-root
```

### Problema: Teste muito lento

**Sintoma:** REQ/S muito baixa

**Causas possíveis:**

1. RAM insuficiente
2. CPU sobrecarregada
3. Muitas instâncias do WordPress
4. Carga de usuários muito alta

**Soluções:**

```bash
# Verificar recursos
docker stats

# Reduzir número de instâncias
docker-compose up -d --scale wordpress=1

# Reduzir carga de usuários
# Editar USER_LOADS em scripts/run-load-tests.sh

# Aumentar recursos do Docker
# Docker Desktop > Settings > Resources
```

### Problema: Locust não responde na porta 8089

**Solução:**

```bash
# Verificar se está rodando
docker ps | grep locust

# Verificar logs
docker-compose logs locust

# Reiniciar
docker-compose restart locust

# Acessar
open http://localhost:8089
```

### Problema: Erro 502 Bad Gateway

**Sintoma:** Nginx retorna 502

**Causa:** WordPress não está respondendo

**Solução:**

```bash
# Verificar status dos containers
docker-compose ps

# Verificar logs do nginx
docker-compose logs nginx

# Verificar conectividade
docker-compose exec nginx ping wordpress
```

## 📈 Interpretando os Resultados

### Métricas Importantes

1. **REQ/S (Requisições por Segundo)**
   - Indica throughput do sistema
   - Maior = melhor desempenho
   - Comparar entre diferentes arquiteturas

2. **Falhas (%)**
   - Percentual de requisições que falharam (4xx, 5xx)
   - 0% = ideal
   - \>5% = problema sério

3. **Tempo de Resposta**
   - Média: indicador geral
   - Mediana (p50): experiência típica
   - p95/p99: experiência do pior caso

### Análise Comparativa

**Exemplo de resultado esperado:**

| Instâncias | Usuários | REQ/S | Falhas |
|-----------|----------|-------|--------|
| 1 | 10 | 50 | 0% |
| 1 | 100 | 120 | 5% |
| 2 | 100 | 200 | 1% |
| 4 | 100 | 350 | 0% |

**Interpretação:**

- Com 1 instância e 100 usuários: começa a degradar (5% falhas)
- Com 2 instâncias e 100 usuários: melhora significativa
- Com 4 instâncias e 100 usuários: desempenho ideal

### Gráficos no Locust

Acesse <http://localhost:8089> durante os testes para ver:

1. **Total Requests per Second**: Vazão do sistema
2. **Response Times**: Latência ao longo do tempo
3. **Number of Users**: Rampa de usuários
4. **Statistics Table**: Métricas detalhadas por endpoint

## 🎓 Próximos Passos

Após entender os resultados, você pode:

1. **Documentar achados**: Quais configurações tiveram melhor desempenho?
2. **Otimizar**: Cache, CDN, ajustes no PHP/MySQL
3. **Testar novamente**: Validar as otimizações
4. **Dimensionar produção**: Baseado nos resultados, quantas instâncias são necessárias?

## 📝 Comandos Úteis

```bash
# Ver todos os containers rodando
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Parar todos os containers
docker-compose down

# Parar e remover volumes (limpar banco de dados)
docker-compose down -v

# Reconstruir imagens
docker-compose build --no-cache

# Escalar WordPress
docker-compose up -d --scale wordpress=3

# Acessar shell de um container
docker-compose exec wordpress bash
docker-compose exec db mysql -uroot -proot wordpress

# Ver uso de recursos
docker stats

# Limpar sistema Docker
docker system prune -a
```

## 📧 Suporte

Para problemas ou dúvidas:

1. Verificar seção [Troubleshooting](#troubleshooting)
2. Verificar logs: `docker-compose logs`
3. Consultar documentação oficial:
   - [Docker](https://docs.docker.com/)
   - [Locust](https://docs.locust.io/)
   - [WordPress](https://wordpress.org/support/)

---

**Desenvolvido para testes de carga e avaliação de desempenho do WordPress.**
