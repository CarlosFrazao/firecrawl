export interface SiteHeuristic {
  domainPattern: RegExp;
  instructions: string;
  recommendedSelectors?: {
    [key: string]: string;
  };
  actionsBeforeExtraction?: Array<{
    type: 'click' | 'wait' | 'scroll' | 'type';
    selector?: string;
    value?: string;
    delay?: number;
  }>;
}

import { amazonHeuristic } from './notes/amazon';
import { googleMapsHeuristic } from './notes/google-maps';
import { linkedinHeuristic } from './notes/linkedin';

const registeredHeuristics: SiteHeuristic[] = [
  amazonHeuristic,
  googleMapsHeuristic,
  linkedinHeuristic
];

/**
 * Injeta heurísticas específicas de domínio se a URL corresponder a um site complexo conhecido.
 * @param url A URL sendo raspada.
 * @returns O objeto SiteHeuristic ou null se não houver correspondência.
 */
export function getHeuristicsForUrl(url: string): SiteHeuristic | null {
  for (const heuristic of registeredHeuristics) {
    if (heuristic.domainPattern.test(url)) {
      return heuristic;
    }
  }
  return null;
}
