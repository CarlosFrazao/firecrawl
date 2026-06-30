import { SiteHeuristic } from '../index';

export const googleMapsHeuristic: SiteHeuristic = {
  domainPattern: /google\.(com|com\.br)\/maps/i,
  instructions: `
    ESTRATÉGIA DE EXTRAÇÃO GOOGLE MAPS:
    - O conteúdo principal (dados do local) está em um painel lateral dinâmico.
    - O nome do local geralmente é um <h1> com a classe '.DUwDvf'.
    - Avaliações e estrelas estão dentro da div '.F7nice'.
    - Para coletar reviews (comentários), é necessário rolar o painel específico '.m6QErb', não a página inteira.
  `,
  recommendedSelectors: {
    placeName: 'h1.DUwDvf',
    rating: '.F7nice span[aria-hidden="true"]',
    address: 'button[data-item-id="address"]',
    phone: 'button[data-item-id^="phone:"]'
  },
  actionsBeforeExtraction: [
    { type: 'wait', delay: 3000 } // Esperar o painel renderizar
  ]
};
