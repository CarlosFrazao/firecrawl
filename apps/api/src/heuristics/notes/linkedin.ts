import { SiteHeuristic } from '../index';

export const linkedinHeuristic: SiteHeuristic = {
  domainPattern: /linkedin\.com/i,
  instructions: `
    ESTRATÉGIA DE EXTRAÇÃO LINKEDIN:
    - O LinkedIn é altamente protegido contra scrapers (AuthWall).
    - Se encontrar '.authwall-join-form', o scraper foi bloqueado.
    - Perfis públicos às vezes expõem dados básicos no JSON-LD. Procure por '<script type="application/ld+json">'.
    - Nome do perfil geralmente fica no <h1> da classe '.top-card-layout__title'.
  `,
  recommendedSelectors: {
    jsonLd: 'script[type="application/ld+json"]',
    profileName: 'h1.top-card-layout__title'
  },
  actionsBeforeExtraction: [
    { type: 'wait', delay: 1000 }
  ]
};
