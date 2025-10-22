#!/usr/bin/env bun
/**
 * Script para gerar relatório HTML com gráficos dos testes de carga
 * Usa dados do Locust para criar visualizações interativas
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = './results';
const REPORT_FILE = join(RESULTS_DIR, 'report.html');

interface TestResult {
  instances: number;
  users: number;
  rps: number;
  avgResponseTime: number;
  medianResponseTime: number;
  failRatio: number;
}

// Parsear resultados
console.log('Parseando resultados dos testes...');

const files = readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json') && f.startsWith('arch'));
const results: TestResult[] = [];

for (const file of files) {
  const match = file.match(/arch(\d+)_users(\d+)/);
  if (!match) continue;

  const instances = parseInt(match[1]);
  const users = parseInt(match[2]);

  const filePath = join(RESULTS_DIR, file);
  const data = await Bun.file(filePath).json();

  if (data.stats && data.stats.length > 0) {
    const stats = data.stats[0];
    results.push({
      instances,
      users,
      rps: stats.total_rps || 0,
      avgResponseTime: stats.avg_response_time || 0,
      medianResponseTime: stats.median_response_time || 0,
      failRatio: (stats.fail_ratio || 0) * 100,
    });
  }
}

if (results.length === 0) {
  console.log('❌ Nenhum resultado encontrado!');
  console.log('Execute primeiro: bun run test:load');
  process.exit(1);
}

console.log(`✓ ${results.length} resultados encontrados`);

// Preparar dados para gráficos
const byUsers: Record<number, TestResult[]> = {};
const byInstances: Record<number, TestResult[]> = {};

for (const r of results) {
  if (!byUsers[r.users]) byUsers[r.users] = [];
  byUsers[r.users].push(r);

  if (!byInstances[r.instances]) byInstances[r.instances] = [];
  byInstances[r.instances].push(r);
}

// Gerar HTML com Chart.js
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Testes de Carga - WordPress</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 16px;
    }
    .section {
      margin-bottom: 50px;
    }
    h2 {
      color: #444;
      margin-bottom: 20px;
      font-size: 24px;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    .chart-container {
      position: relative;
      height: 400px;
      margin-bottom: 40px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 30px;
    }
    @media print {
      .container { box-shadow: none; }
      .chart-container { height: 300px; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Relatório de Testes de Carga - WordPress</h1>
    <p class="subtitle">Gerado em ${new Date().toLocaleString('pt-BR')}</p>

    <div class="section">
      <h2>Gráficos por Número de Usuários</h2>
      <p>Eixo X: Número de Usuários | Linhas: Número de Instâncias do WordPress</p>
      <div class="grid">
        <div class="chart-container">
          <canvas id="rps-by-users"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="response-time-by-users"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="fail-ratio-by-users"></canvas>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Gráficos por Número de Instâncias</h2>
      <p>Eixo X: Número de Instâncias do WordPress | Linhas: Número de Usuários</p>
      <div class="grid">
        <div class="chart-container">
          <canvas id="rps-by-instances"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="response-time-by-instances"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="fail-ratio-by-instances"></canvas>
        </div>
      </div>
    </div>
  </div>

  <script>
    const results = ${JSON.stringify(results)};

    // Gráficos por usuários
    const userCounts = [...new Set(results.map(r => r.users))].sort((a, b) => a - b);
    const instanceCounts = [...new Set(results.map(r => r.instances))].sort((a, b) => a - b);

    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];

    // RPS by Users
    new Chart(document.getElementById('rps-by-users'), {
      type: 'line',
      data: {
        labels: userCounts,
        datasets: instanceCounts.map((inst, idx) => ({
          label: \`\${inst} instância(s)\`,
          data: userCounts.map(u => {
            const r = results.find(r => r.users === u && r.instances === inst);
            return r ? r.rps : null;
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.3,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Requisições por Segundo vs Usuários' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'RPS' } },
          x: { title: { display: true, text: 'Número de Usuários' } }
        }
      }
    });

    // Response Time by Users
    new Chart(document.getElementById('response-time-by-users'), {
      type: 'line',
      data: {
        labels: userCounts,
        datasets: instanceCounts.map((inst, idx) => ({
          label: \`\${inst} instância(s)\`,
          data: userCounts.map(u => {
            const r = results.find(r => r.users === u && r.instances === inst);
            return r ? r.avgResponseTime : null;
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.3,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Tempo de Resposta Médio vs Usuários' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Tempo (ms)' } },
          x: { title: { display: true, text: 'Número de Usuários' } }
        }
      }
    });

    // Fail Ratio by Users
    new Chart(document.getElementById('fail-ratio-by-users'), {
      type: 'line',
      data: {
        labels: userCounts,
        datasets: instanceCounts.map((inst, idx) => ({
          label: \`\${inst} instância(s)\`,
          data: userCounts.map(u => {
            const r = results.find(r => r.users === u && r.instances === inst);
            return r ? r.failRatio : null;
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.3,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Taxa de Falhas vs Usuários' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Falhas (%)' } },
          x: { title: { display: true, text: 'Número de Usuários' } }
        }
      }
    });

    // RPS by Instances
    new Chart(document.getElementById('rps-by-instances'), {
      type: 'line',
      data: {
        labels: instanceCounts,
        datasets: userCounts.map((users, idx) => ({
          label: \`\${users} usuários\`,
          data: instanceCounts.map(inst => {
            const r = results.find(r => r.users === users && r.instances === inst);
            return r ? r.rps : null;
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.3,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Requisições por Segundo vs Instâncias' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'RPS' } },
          x: { title: { display: true, text: 'Número de Instâncias' } }
        }
      }
    });

    // Response Time by Instances
    new Chart(document.getElementById('response-time-by-instances'), {
      type: 'line',
      data: {
        labels: instanceCounts,
        datasets: userCounts.map((users, idx) => ({
          label: \`\${users} usuários\`,
          data: instanceCounts.map(inst => {
            const r = results.find(r => r.users === users && r.instances === inst);
            return r ? r.avgResponseTime : null;
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.3,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Tempo de Resposta Médio vs Instâncias' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Tempo (ms)' } },
          x: { title: { display: true, text: 'Número de Instâncias' } }
        }
      }
    });

    // Fail Ratio by Instances
    new Chart(document.getElementById('fail-ratio-by-instances'), {
      type: 'line',
      data: {
        labels: instanceCounts,
        datasets: userCounts.map((users, idx) => ({
          label: \`\${users} usuários\`,
          data: instanceCounts.map(inst => {
            const r = results.find(r => r.users === users && r.instances === inst);
            return r ? r.failRatio : null;
          }),
          borderColor: colors[idx % colors.length],
          backgroundColor: colors[idx % colors.length] + '20',
          tension: 0.3,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Taxa de Falhas vs Instâncias' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Falhas (%)' } },
          x: { title: { display: true, text: 'Número de Instâncias' } }
        }
      }
    });
  </script>
</body>
</html>`;

await Bun.write(REPORT_FILE, html);

console.log('\n========================================');
console.log('✓ Relatório HTML gerado com sucesso!');
console.log('========================================');
console.log(`Arquivo: ${REPORT_FILE}`);
console.log(`\nAbra no navegador com: open ${REPORT_FILE}`);
console.log('========================================\n');
