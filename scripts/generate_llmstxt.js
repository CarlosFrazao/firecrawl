#!/usr/bin/env node

/**
 * generate_llmstxt.js
 * Utilitário para gerar llms.txt e llms-full.txt a partir de um domínio de documentação
 * usando a API local do Firecrawl (http://localhost:3002).
 */

import fs from 'fs';
import path from 'path';


// Configurações padrão
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'http://localhost:3002';
const DEFAULT_LIMIT = 100;
const CONCURRENCY_LIMIT = 5;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// Função auxiliar para sleep/backoff
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Processa argumentos da linha de comando
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith('-')) {
    console.error('Uso: node generate_llmstxt.js <URL> [--limit N] [--output <path>] [--index-only]');
    process.exit(1);
  }

  const targetUrl = args[0];
  let limit = DEFAULT_LIMIT;
  let outputDir = null;
  let indexOnly = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--index-only') {
      indexOnly = true;
    }
  }

  return { targetUrl, limit, outputDir, indexOnly };
}

// Faz requisição HTTP POST genérica para a API local do Firecrawl
async function callFirecrawlApi(endpoint, body) {
  const url = `${FIRECRAWL_API_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer local_free_token'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  return response.json();
}

// Scrape de URL única com mecanismo de retry e backoff exponencial
async function scrapeUrlWithRetry(url, attempt = 1) {
  try {
    const result = await callFirecrawlApi('/v1/scrape', {
      url: url,
      formats: ['markdown'],
      onlyMainContent: true
    });

    if (result && result.success && result.data) {
      return result.data;
    }
    throw new Error('Retorno da API sem dados de scrape ou marcado como insucesso');
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[RETRY] Falha ao raspar ${url} (Tentativa ${attempt}/${MAX_RETRIES}). Tentando novamente em ${delay}ms... Erro: ${error.message}`);
      await sleep(delay);
      return scrapeUrlWithRetry(url, attempt + 1);
    }
    throw error;
  }
}

// Execução paralela com concorrência limitada
async function processBatch(urls, concurrencyLimit, taskRunner, onProgress) {
  const results = [];
  const executing = new Set();
  let completedCount = 0;

  for (const url of urls) {
    const promise = (async () => {
      try {
        const data = await taskRunner(url);
        return { url, data, success: true };
      } catch (err) {
        return { url, error: err.message, success: false };
      } finally {
        completedCount++;
        onProgress(completedCount, urls.length, url);
      }
    })();

    results.push(promise);
    executing.add(promise);

    const clean = () => executing.delete(promise);
    promise.then(clean, clean);

    if (executing.size >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// Função principal
async function main() {
  const { targetUrl, limit, outputDir, indexOnly } = parseArgs();

  console.log(`\n======================================================`);
  console.log(`🚀 Iniciando gerador llms.txt via Firecrawl Local`);
  console.log(`📍 URL Alvo: ${targetUrl}`);
  console.log(`📊 Limite Máximo de Páginas: ${limit}`);
  console.log(`📁 Modo apenas índice: ${indexOnly ? 'Sim' : 'Não'}`);
  console.log(`======================================================\n`);

  // 1. Mapeamento de links
  console.log(`🔍 1. Mapeando URLs do domínio usando /v1/map...`);
  let links = [];
  try {
    const mapResult = await callFirecrawlApi('/v1/map', { url: targetUrl });
    if (mapResult && mapResult.success && Array.isArray(mapResult.links)) {
      links = mapResult.links;
    } else {
      console.error('❌ Resposta inválida do endpoint /v1/map:', mapResult);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Falha ao mapear o domínio: ${error.message}`);
    console.error('Certifique-se de que o Docker do Firecrawl esteja ativo na porta 3002.');
    process.exit(1);
  }

  // Filtragem e normalização de URLs
  let targetOrigin;
  try {
    targetOrigin = new URL(targetUrl).origin;
  } catch {
    console.error(`❌ URL inválida: ${targetUrl}`);
    process.exit(1);
  }

  const uniqueLinks = Array.from(
    new Set(
      links
        .map(link => {
          try {
            const parsed = new URL(link);
            // Normaliza removendo fragmentos (#)
            parsed.hash = '';
            return parsed.toString();
          } catch {
            return null;
          }
        })
        .filter(link => {
          if (!link) return false;
          try {
            const parsed = new URL(link);
            // Mantém apenas o mesmo domínio
            return parsed.origin === targetOrigin;
          } catch {
            return false;
          }
        })
    )
  );

  console.log(`✨ Total de URLs únicas encontradas: ${uniqueLinks.length}`);
  const urlsToProcess = uniqueLinks.slice(0, limit);
  console.log(`📝 URLs selecionadas para scrape (limitado a ${limit}): ${urlsToProcess.length}\n`);

  if (urlsToProcess.length === 0) {
    console.log('⚠️ Nenhuma URL encontrada para processamento.');
    process.exit(0);
  }

  // 2. Execução do scrape
  console.log(`⏳ 2. Iniciando raspagem das páginas com concorrência máxima de ${CONCURRENCY_LIMIT}...`);
  
  const processResults = await processBatch(
    urlsToProcess,
    CONCURRENCY_LIMIT,
    (url) => scrapeUrlWithRetry(url),
    (current, total, url) => {
      console.log(`[${current}/${total}] Processado: ${url}`);
    }
  );

  // 3. Organização dos resultados e geração dos arquivos
  console.log(`\n💾 3. Gravando resultados...`);
  
  const successfulScrapes = processResults.filter(r => r.success && r.data && r.data.markdown && r.data.markdown.length >= 100);
  console.log(`✅ Páginas raspadas com sucesso: ${successfulScrapes.length} de ${urlsToProcess.length}`);

  // Determinar pasta de saída
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const resolvedOutputDir = outputDir 
    ? path.resolve(outputDir) 
    : path.join(process.cwd(), 'llms_output', `${new URL(targetUrl).hostname}-${timestamp}`);

  if (!fs.existsSync(resolvedOutputDir)) {
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  // Obter título do site a partir da página principal (se disponível)
  const homePage = successfulScrapes.find(r => r.url === targetUrl || r.url === targetUrl + '/' || r.url === targetOrigin);
  const siteTitle = homePage?.data?.metadata?.title || new URL(targetUrl).hostname;
  const siteDescription = homePage?.data?.metadata?.description || `Documentação para ${new URL(targetUrl).hostname}`;

  // Gerar llms.txt (Índice)
  let indexContent = `# ${siteTitle}\n`;
  indexContent += `> ${siteDescription}\n\n`;
  indexContent += `## Pages\n\n`;

  // Gerar llms-full.txt (Conteúdo completo) se solicitado
  let fullContent = '';

  for (const item of successfulScrapes) {
    const title = item.data.metadata?.title || item.data.title || 'Sem título';
    const description = item.data.metadata?.description || '';
    
    // Adiciona ao índice
    indexContent += `- [${title}](${item.url})${description ? `: ${description}` : ''}\n`;

    // Adiciona ao compilado full
    if (!indexOnly) {
      fullContent += `# ${title}\n`;
      fullContent += `URL: ${item.url}\n`;
      if (description) {
        fullContent += `Description: ${description}\n`;
      }
      fullContent += `\n---\n\n`;
      fullContent += `${item.data.markdown}\n\n`;
      fullContent += `\n<!-- PAGE BREAK -->\n\n`;
    }
  }

  const indexPath = path.join(resolvedOutputDir, 'llms.txt');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log(`📄 llms.txt gerado com sucesso em: ${indexPath}`);

  if (!indexOnly) {
    const fullPath = path.join(resolvedOutputDir, 'llms-full.txt');
    fs.writeFileSync(fullPath, fullContent, 'utf8');
    console.log(`📄 llms-full.txt gerado com sucesso em: ${fullPath}`);
  }

  console.log(`\n🎉 Processamento concluído com sucesso! Pasta de saída: ${resolvedOutputDir}\n`);
}

main().catch(err => {
  console.error(`❌ Ocorreu um erro fatal durante a execução:`, err);
  process.exit(1);
});
