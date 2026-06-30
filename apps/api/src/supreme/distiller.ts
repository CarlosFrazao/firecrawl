import { load } from 'cheerio';

/**
 * DOM Distillation (Token Saver)
 * Remove elementos HTML não semânticos para reduzir o tamanho do payload para a LLM,
 * economizando até 80% de tokens e prevenindo alucinações.
 */
export function distillDOM(html: string): string {
  try {
    const $ = load(html);
    
    // Remove tags inúteis para extração de dados
    $('script, style, noscript, iframe, svg, path, symbol, meta, link, header, footer, nav, aside').remove();
    
    // Remove comentários HTML
    $('*').contents().filter(function() {
      return this.type === 'comment';
    }).remove();
    
    // Remove atributos de estilo e classes puramente visuais, mantendo ids e classes que podem ser estruturais
    $('*').removeAttr('style').removeAttr('width').removeAttr('height');
    
    // Limpar espaços em branco redundantes
    const cleanHtml = $.html().replace(/\\s{2,}/g, ' ').replace(/\\n+/g, '\\n');
    return cleanHtml;
  } catch (error) {
    console.error('Falha na destilação do DOM:', error);
    return html; // Fallback para HTML original em caso de erro
  }
}
