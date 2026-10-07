/* global WebImporter */

/**
 * Parser for the category-showcase block.
 * Source: AEM exploreOurStores component (`.exploreOurStores`): a heading with a
 * text CTA beside it, then a row of image cards linking to blog posts.
 * Output: a labelled table authors can read in DA:
 *   [Category Showcase (side-cta-variant, mob-fix)]
 *   [Title | text]  [Subtitle | text]  [CTA | link]  [Open in new tab | true/false]
 *   [Desktop image | Mobile image | Title | Subtitle | Link]   (header row)
 *   [image | (empty: uses desktop) | title | description | link]   (one row per card)
 */
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() || '';

/**
 * @param {Element} [source] An anchor from the source page
 * @param {string} url The source page URL
 * @param {Document} document The document
 * @param {string} [label] The link text (defaults to the URL)
 * @returns {HTMLAnchorElement|string} The link, or empty string when none
 */
function linkOf(source, url, document, label) {
  const href = source?.getAttribute('href');
  if (!href) return '';
  const link = document.createElement('a');
  link.href = new URL(href, url).href;
  link.textContent = label || link.href;
  return link;
}

export default function parse(element, { document, url }) {
  const cells = [['Category Showcase (side-cta-variant, mob-fix)']];

  const header = element.querySelector('.header-explore-stores');
  cells.push(['Title', text(header?.querySelector('h1, h2, h3, h4, h5, h6'))]);
  cells.push(['Subtitle', '']);

  const cta = header?.querySelector('.cta a[href]');
  cells.push(['CTA', linkOf(cta, url, document, text(cta))]);
  cells.push(['Open in new tab', cta?.getAttribute('target') === '_blank' ? 'true' : 'false']);

  cells.push(['Desktop image', 'Mobile image', 'Title', 'Subtitle', 'Link']);
  element.querySelectorAll('.block-explore-stores').forEach((card) => {
    const srcImg = card.querySelector('img');
    let image = '';
    if (srcImg?.getAttribute('src')) {
      image = document.createElement('img');
      image.src = new URL(srcImg.getAttribute('src'), url).href;
      image.alt = srcImg.getAttribute('alt') || '';
    }

    cells.push([
      image,
      '',
      text(card.querySelector('.subtext-icon-wrapper, .informationWrap')),
      '',
      linkOf(card.querySelector('a[href]'), url, document),
    ]);
  });

  element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
}
