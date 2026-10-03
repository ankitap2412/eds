/* global WebImporter */

/**
 * Parser for the explore-store block.
 * Source: AEM whychooseus component, variantThree (`.explore-store`) or
 * variantFive (`.explore-store.bhps-whychoos`).
 * Output: a labelled table authors can read in DA:
 *   [Explore Store (variant)]
 *   [Title | text]  [Sub title | text]
 *   [Icon | Title | Description | Link | Border colour]   (header row)
 *   [icon | title | description | link | #hex]            (one row per card)
 */
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() || '';

export default function parse(element, { document, url }) {
  const name = element.classList.contains('bhps-whychoos') ? 'Explore Store (bhps)' : 'Explore Store';
  const cells = [[name]];

  const title = text(element.querySelector('.our-services-title'));
  if (title) cells.push(['Title', title]);
  const subtitle = text(element.querySelector('.our-services-subheading'));
  if (subtitle) cells.push(['Sub title', subtitle]);

  cells.push(['Icon', 'Title', 'Description', 'Link', 'Border colour']);
  element.querySelectorAll('.explore-card').forEach((card) => {
    const srcImg = card.querySelector('img');
    let icon = '';
    if (srcImg?.getAttribute('src')) {
      icon = document.createElement('img');
      icon.src = new URL(srcImg.getAttribute('src'), url).href;
      icon.alt = '';
    }

    const srcLink = card.querySelector('a[href]');
    let link = '';
    if (srcLink) {
      link = document.createElement('a');
      link.href = new URL(srcLink.getAttribute('href'), url).href;
      link.textContent = link.href;
    }

    const border = (card.getAttribute('style') || '').match(/border-bottom-color:\s*([^;]+)/i)?.[1].trim() || '';

    cells.push([
      icon,
      text(card.querySelector('.explore-card-title')),
      text(card.querySelector('.explore-card-desc')),
      link,
      border,
    ]);
  });

  element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
}
