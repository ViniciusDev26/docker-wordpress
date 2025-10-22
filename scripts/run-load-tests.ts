#!/usr/bin/env bun
/**
 * Script para executar testes de carga automatizados
 * Testa diferentes arquiteturas (número de instâncias) e cargas (número de usuários)
 */

// Cores para output
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

// Configurações dos testes
const config = {
  architectures: [1, 2, 3], // Número de instâncias do WordPress (mínimo 3)
  userLoads: [10, 100, 1000], // Número de usuários simultâneos (mínimo 3 crescentes)
  testDuration: 20, // Duração de cada teste em segundos (reduzido para otimizar tempo)
  spawnRate: 50, // Taxa de spawn (usuários por segundo) - mais rápido
  waitBetweenTests: 3, // Tempo de espera entre testes (segundos)
  resultsDir: './results',
};

// Recriar diretório de resultados (limpar resultados antigos)
console.log(`${colors.yellow}Limpando resultados anteriores...${colors.reset}`);
await Bun.$`rm -rf ${config.resultsDir}`.quiet();
await Bun.$`mkdir -p ${config.resultsDir}`.quiet();
console.log(`${colors.green}✓ Diretório de resultados recriado${colors.reset}\n`);

console.log(`${colors.blue}========================================${colors.reset}`);
console.log(`${colors.blue}INICIANDO TESTES DE CARGA AUTOMATIZADOS${colors.reset}`);
console.log(`${colors.blue}========================================${colors.reset}\n`);
console.log(`Arquiteturas a testar: ${colors.green}${config.architectures.join(', ')}${colors.reset} instâncias`);
console.log(`Cargas a testar: ${colors.green}${config.userLoads.join(', ')}${colors.reset} usuários`);
console.log(`Duração de cada teste: ${colors.green}${config.testDuration}${colors.reset} segundos`);
console.log(`Diretório de resultados: ${colors.green}${config.resultsDir}${colors.reset}\n`);

/**
 * Aguarda serviços estarem prontos
 */
async function waitForServices(): Promise<boolean> {
  console.log(`${colors.yellow}Aguardando serviços ficarem prontos...${colors.reset}`);

  const maxRetries = 30;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch('http://localhost');
      const status = response.status;

      if (status === 200 || status === 301 || status === 302) {
        console.log(`${colors.green}✓ WordPress está pronto!${colors.reset}`);
        return true;
      }
    } catch (error) {
      // Ignorar erros de conexão
    }

    retryCount++;
    console.log(`Tentativa ${retryCount}/${maxRetries}...`);
    await Bun.sleep(5000);
  }

  console.log(`${colors.red}✗ Timeout: WordPress não respondeu${colors.reset}`);
  return false;
}

/**
 * Executa um teste de carga
 */
async function runTest(instances: number, users: number): Promise<void> {
  const testName = `arch${instances}_users${users}`;
  const timestamp = Date.now();
  const resultFile = `${config.resultsDir}/${testName}_${timestamp}.csv`;

  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TESTE: ${instances} instância(s) | ${users} usuários${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);

  // Escalar WordPress
  console.log(`${colors.yellow}Escalando WordPress para ${instances} instância(s)...${colors.reset}`);
  const scaleProc = Bun.spawn([
    'docker-compose',
    'up',
    '-d',
    '--scale',
    `wordpress=${instances}`,
    '--no-recreate'
  ]);

  await scaleProc.exited;

  // Aguardar serviços estarem prontos
  const ready = await waitForServices();
  if (!ready) {
    console.log(`${colors.red}✗ Pulando teste devido a timeout${colors.reset}`);
    return;
  }

  // Executar teste Locust via API
  console.log(`${colors.yellow}Iniciando teste de carga com ${users} usuários...${colors.reset}`);

  try {
    // Iniciar teste (Locust API)
    const startResponse = await fetch('http://localhost:8089/swarm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `user_count=${users}&spawn_rate=${config.spawnRate}`,
    });

    if (!startResponse.ok) {
      throw new Error(`Falha ao iniciar teste: ${startResponse.status}`);
    }

    console.log(`${colors.green}✓ Teste iniciado!${colors.reset}`);
    console.log(`${colors.yellow}Aguardando ${config.testDuration} segundos...${colors.reset}`);

    // Exibir progresso
    for (let i = 1; i <= config.testDuration; i++) {
      process.stdout.write(`Progresso: ${i}/${config.testDuration}s\r`);
      await Bun.sleep(1000);
    }
    console.log(''); // Nova linha após o progresso

    // Coletar estatísticas
    console.log(`${colors.yellow}Coletando estatísticas...${colors.reset}`);
    const statsResponse = await fetch('http://localhost:8089/stats/requests');
    const statsData = await statsResponse.json();

    await Bun.write(`${resultFile}.json`, JSON.stringify(statsData, null, 2));

    // Parar teste
    await fetch('http://localhost:8089/stop');

    console.log(`${colors.green}✓ Teste concluído!${colors.reset}`);
    console.log(`Resultados salvos em: ${colors.blue}${resultFile}.json${colors.reset}`);

    // Aguardar antes do próximo teste (reduzido)
    await Bun.sleep(config.waitBetweenTests * 1000);
  } catch (error) {
    console.log(`${colors.red}✗ Erro ao executar teste: ${error}${colors.reset}`);
  }
}

/**
 * Função principal
 */
async function main() {
  // Verificar se Locust está rodando
  console.log(`${colors.yellow}Verificando se Locust está ativo...${colors.reset}`);

  const psProc = Bun.spawn(['docker', 'ps'], {
    stdout: 'pipe',
  });

  const psOutput = await new Response(psProc.stdout).text();

  if (!psOutput.includes('locust')) {
    console.log(`${colors.red}✗ Container Locust não está rodando!${colors.reset}`);
    console.log(`${colors.yellow}Iniciando ambiente...${colors.reset}`);

    const upProc = Bun.spawn(['docker-compose', 'up', '-d']);
    await upProc.exited;

    await waitForServices();
  }

  console.log(`${colors.green}✓ Locust está ativo!${colors.reset}\n`);

  // Executar testes para cada combinação
  const totalTests = config.architectures.length * config.userLoads.length;
  let currentTest = 0;

  console.log(`${colors.blue}Total de testes a executar: ${totalTests}${colors.reset}\n`);

  for (const arch of config.architectures) {
    for (const users of config.userLoads) {
      currentTest++;
      console.log(`${colors.blue}[${currentTest}/${totalTests}]${colors.reset}`);
      await runTest(arch, users);
    }
  }

  // Gerar resumo
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}TODOS OS TESTES CONCLUÍDOS!${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  console.log(`Total de testes executados: ${colors.green}${totalTests}${colors.reset}`);
  console.log(`Resultados salvos em: ${colors.blue}${config.resultsDir}/${colors.reset}\n`);
  console.log(`${colors.yellow}Para analisar os resultados, você pode:${colors.reset}`);
  console.log(`1. Verificar os arquivos JSON em ${config.resultsDir}/`);
  console.log(`2. Acessar o Locust: ${colors.blue}http://localhost:8089${colors.reset}`);
  console.log(`3. Usar o script de análise: ${colors.green}bun run analyze${colors.reset}\n`);
}

// Executar
main().catch((error) => {
  console.error(`${colors.red}Erro fatal: ${error}${colors.reset}`);
  process.exit(1);
});
