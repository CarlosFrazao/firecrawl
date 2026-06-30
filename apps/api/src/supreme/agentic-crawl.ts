/**
 * Agentic A* Search Crawling
 * Avalia URLs descobertas e pontua sua relevância para o objetivo da extração.
 * Economiza recursos evitando o rastreamento de páginas inúteis (ex: Política de Privacidade)
 * quando o objetivo é "Encontrar produtos".
 */

export interface CrawlGoal {
  description: string;
  keywords: string[];
}

export function scoreUrlRelevance(url: string, linkText: string, goal: CrawlGoal): number {
  let score = 0;
  const normalizedUrl = url.toLowerCase();
  const normalizedText = linkText.toLowerCase();

  // Penalizar páginas comumente irrelevantes a menos que especificamente solicitadas
  const antiPatterns = ['/privacy', '/terms', '/faq', '/login', '/cart', 'password'];
  for (const pattern of antiPatterns) {
    if (normalizedUrl.includes(pattern) || normalizedText.includes(pattern)) {
      score -= 50;
    }
  }

  // Bonificar keywords do objetivo
  for (const keyword of goal.keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (normalizedUrl.includes(lowerKeyword)) score += 20;
    if (normalizedText.includes(lowerKeyword)) score += 30;
  }

  // TODO: Integrar chamada LLM rápida (ex: Llama 3 local) para pontuação semântica
  // const semanticScore = await askLLM(\`Rate this link for goal '\${goal.description}': \${linkText} (\${url})\`);

  return score;
}

export function sortLinksByRelevance(links: Array<{url: string, text: string}>, goal: CrawlGoal) {
  return links
    .map(link => ({ ...link, score: scoreUrlRelevance(link.url, link.text, goal) }))
    .filter(link => link.score > -20) // Drop links altamente irrelevantes
    .sort((a, b) => b.score - a.score);
}
