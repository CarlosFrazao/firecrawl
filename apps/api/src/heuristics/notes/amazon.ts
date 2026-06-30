import { SiteHeuristic } from '../index';

export const amazonHeuristic: SiteHeuristic = {
  domainPattern: /amazon\.(com|com\.br|co\.uk|de)/i,
  instructions: `
    ESTRATÉGIA DE EXTRAÇÃO AMAZON:
    - O preço final geralmente está fragmentado. Procure pela classe '.a-price-whole' e '.a-price-fraction'.
    - Se a página pedir CAPTCHA ou login, ignore e tente procurar o bloco de produto no DOM original.
    - Avaliações estão contidas no id 'cm_cr_dp_d_rating_histogram'.
    - Título do produto é sempre id 'productTitle'.
  `,
  recommendedSelectors: {
    title: '#productTitle',
    price_whole: '.a-price-whole',
    price_fraction: '.a-price-fraction',
    reviews: '#cm_cr_dp_d_rating_histogram'
  },
  actionsBeforeExtraction: [
    { type: 'scroll', value: 'bottom' }, // Trigger lazy load das imagens e reviews
    { type: 'wait', delay: 2000 }
  ]
};
