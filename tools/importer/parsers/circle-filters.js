/* global WebImporter */

/**
 * Parser for the circle-filters block.
 * Source: AEM `.circlefilters` component (default, service and AP Homes carousel variants),
 * the title component above it, and the description (`.rte`) and CTA (`.cta`) components
 * that share its grey container.
 * Output: a labelled table authors can read in DA:
 *   [Circle Filters (variant)]
 *   [Title | heading]  [Sub title | text]  [Description | text]
 *   [CTA | link]  [Open in new tab | true/false]
 *   [Image | Name | Page link | Selected | Open in new tab]   (header row)
 *   [image | name | url | true/false | true/false]            (one row per item)
 */
function variantName(element) {
  if (element.querySelector('.apHomes-circleFilter-Variant')) return 'Circle Filters (carousel)';
  if (element.querySelector('.service-circular-container-wp')) return 'Circle Filters (service)';
  return 'Circle Filters';
}

function link(document, href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

export default function parse(element, {
  document, heading, container = element.closest('.responsivegrid.padding45'),
}) {
  const cells = [[variantName(element)]];

  if (heading) {
    const h = document.createElement(heading.tagName.toLowerCase());
    const text = heading.textContent.replace(/\s+/g, ' ').trim();
    const srcLink = heading.querySelector('a[href]');
    if (srcLink) h.append(link(document, srcLink.href, text));
    else h.textContent = text;
    cells.push(['Title', h]);
  }

  const subtitle = element.querySelector('.description-area .desc')?.textContent.trim();
  if (subtitle) cells.push(['Sub title', subtitle]);

  const description = container?.querySelector('.rte p:not(.d-none)')?.textContent.replace(/\s+/g, ' ').trim();
  if (description) cells.push(['Description', description]);

  const cta = container?.querySelector('.cta a[href]');
  if (cta) {
    cells.push(['CTA', link(document, cta.href, cta.textContent.trim())]);
    cells.push(['Open in new tab', cta.getAttribute('target') === '_blank' ? 'true' : 'false']);
  }

  cells.push(['Image', 'Name', 'Page link', 'Selected', 'Open in new tab']);
  element.querySelectorAll('.carousel').forEach((item) => {
    const srcImg = item.querySelector('img');
    if (!srcImg) return;

    const img = document.createElement('img');
    img.src = srcImg.src;
    img.alt = srcImg.getAttribute('alt') || srcImg.getAttribute('title') || '';

    const nameCell = document.createElement('div');
    item.querySelectorAll('.desc-wp p').forEach((srcP) => {
      const text = srcP.textContent.trim();
      if (!text) return;
      const p = document.createElement('p');
      p.textContent = text;
      nameCell.append(p);
    });

    const srcLink = item.querySelector('a[href]:not([href^="javascript"])');
    cells.push([
      img,
      nameCell,
      srcLink ? link(document, srcLink.href, srcLink.href) : '',
      item.classList.contains('selected') ? 'true' : 'false',
      srcLink?.getAttribute('target') === '_blank' ? 'true' : 'false',
    ]);
  });

  element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
}
