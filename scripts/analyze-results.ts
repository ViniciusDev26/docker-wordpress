#!/usr/bin/env bun
/**
 * Script para analisar os resultados dos testes de carga
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Cores
const colors = {
  green: '\x1b[0;32m',
  blue: '\x1b[0;34m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m',
};

const RESULTS_DIR = './results';
const REPORT_FILE = join(RESULTS_DIR, 'summary_report.md');

console.log(`${colors.blue}========================================${colors.reset}`);
console.log(`${colors.blue}ANÁLISE DE RESULTADOS - TESTES DE CARGA${colors.reset}`);
console.log(`${colors.blue}========================================${colors.reset}\n`);

// Verificar se existem resultados
if (!existsSync(RESULTS_DIR)) {
  console.log(`${colors.yellow}Nenhum resultado encontrado em ${RESULTS_DIR}/${colors.reset}`);
  console.log('Execute primeiro: bun run test:load');
  process.exit(1);
}

const files = readdirSync(RESULTS_DIR).filter(file => file.endsWith('.json'));

if (files.length === 0) {
  console.log(`${colors.yellow}Nenhum resultado encontrado em ${RESULTS_DIR}/${colors.reset}`);
  console.log('Execute primeiro: bun run test:load');
  process.exit(1);
}

interface TestStats {
  name: string;
  method: string;
  num_requests: number;
  num_failures: number;
  avg_response_time: number;
  min_response_time: number;
  max_response_time: number;
  current_rps: number;
  median_response_time: number;
  ninetieth_response_time: number;
  avg_content_length: number;
  total_rps: number;
  fail_ratio: number;
}

interface TestResult {
  stats: TestStats[];
  errors: any[];
  total_rps: number;
  fail_ratio: number;
  user_count: number;
}

interface ProcessedResult {
  filename: string;
  instances: number;
  users: number;
  totalRps: number;
  failPercentage: number;
}

// Criar relatório em Markdown
const now = new Date();
const dateStr = now.toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

let reportContent = `# Relatório de Testes de Carga

**Data:** ${dateStr}

## Resultados dos Testes

| Teste | Instâncias | Usuários | REQ/S | Falhas (%) |
|-------|-----------|----------|-------|-----------|
`;

console.log(`${colors.green}Analisando resultados...${colors.reset}\n`);

// Cabeçalho da tabela para console
const header = `${'TESTE'.padEnd(20)} | ${'INSTÂNCIAS'.padEnd(10)} | ${'USUÁRIOS'.padEnd(15)} | ${'REQ/S'.padEnd(15)} | ${'FALHAS (%)'.padEnd(10)}`;
console.log(header);
console.log('-'.repeat(80));

const results: ProcessedResult[] = [];

// Processar cada arquivo JSON
for (const file of files) {
  const filePath = join(RESULTS_DIR, file);
  const fileContent = await Bun.file(filePath).text();

  try {
    const data: TestResult = JSON.parse(fileContent);

    // Extrair informações do nome do arquivo
    const match = file.match(/arch(\d+)_users(\d+)/);

    if (match) {
      const instances = parseInt(match[1]);
      const users = parseInt(match[2]);

      // Extrair métricas do JSON
      let totalRps = 0;
      let failRatio = 0;

      if (data.stats && data.stats.length > 0) {
        // Pegar a primeira entrada (agregado de todas as requisições)
        const aggregatedStats = data.stats[0];
        totalRps = aggregatedStats.total_rps || 0;
        failRatio = aggregatedStats.fail_ratio || 0;
      }

      const failPercentage = failRatio * 100;

      results.push({
        filename: file,
        instances,
        users,
        totalRps,
        failPercentage,
      });

      // Formatar e exibir no console
      const rpsStr = totalRps.toFixed(2);
      const failStr = failPercentage.toFixed(2) + '%';

      console.log(
        `${file.padEnd(20)} | ${instances.toString().padEnd(10)} | ${users.toString().padEnd(15)} | ${rpsStr.padEnd(15)} | ${failStr.padEnd(10)}`
      );

      // Adicionar ao relatório Markdown
      reportContent += `| ${file} | ${instances} | ${users} | ${rpsStr} | ${failStr} |\n`;
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠ Erro ao processar ${file}: ${error}${colors.reset}`);
  }
}

// Adicionar rodapé ao relatório Markdown
reportContent += `
## Observações

- **REQ/S**: Requisições por segundo
- **Falhas**: Percentual de requisições que falharam

## Recursos

- Interface do Locust: [http://localhost:8089](http://localhost:8089)
- Arquivos JSON detalhados disponíveis em: \`./results/\`

---

*Relatório gerado automaticamente pelo script analyze-results.ts*
`;

// Salvar relatório
await Bun.write(REPORT_FILE, reportContent);

console.log(`\n${colors.green}✓ Análise concluída!${colors.reset}`);
console.log(`${colors.blue}Relatório salvo em: ${REPORT_FILE}${colors.reset}\n`);
console.log(`${colors.yellow}Dica:${colors.reset} Para visualizar gráficos detalhados, acesse: ${colors.blue}http://localhost:8089${colors.reset}\n`);

// Análise adicional: Melhores resultados
if (results.length > 0) {
  const bestThroughput = results.reduce((best, current) =>
    current.totalRps > best.totalRps ? current : best
  );

  const lowestFailures = results.reduce((best, current) =>
    current.failPercentage < best.failPercentage ? current : best
  );

  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}DESTAQUES${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  console.log(`${colors.green}Maior throughput:${colors.reset}`);
  console.log(`  ${bestThroughput.filename}`);
  console.log(`  ${bestThroughput.instances} instâncias | ${bestThroughput.users} usuários | ${bestThroughput.totalRps.toFixed(2)} req/s\n`);
  console.log(`${colors.green}Menor taxa de falhas:${colors.reset}`);
  console.log(`  ${lowestFailures.filename}`);
  console.log(`  ${lowestFailures.instances} instâncias | ${lowestFailures.users} usuários | ${lowestFailures.failPercentage.toFixed(2)}%\n`);
}
