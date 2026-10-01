/* global WebImporter */

/**
 * Parser for the circlefilters block.
 * Source: AEM `.circlefilters` component (default, service and AP Homes carousel variants),
 * plus the description (`.rte`) and CTA (`.cta`) components that share its grey container.
 * Output rows:
 *   [Circlefilters (variant)]
 *   [intro text]                          (carousel variant description, optional)
 *   [image | title + description | link | options] per item
 *   [description + CTA]                   (optional)
 */
function variantName(element) {
  if (element.querySelector('.apHomes-circleFilter-Variant')) return 'Circlefilters (carousel)';
  if (element.querySelector('.service-circular-container-wp')) return 'Circlefilters (service)';
  return 'Circlefilters';
}

function textRow(document, paragraphs) {
  const cell = document.createElement('div');
  paragraphs.forEach((p) => cell.append(p));
  return [cell];
}

export default function parse(element, { document, container = element.closest('.responsivegrid.padding45') }) {
  const cells = [[variantName(element)]];

  const intro = element.querySelector('.description-area .desc')?.textContent.trim();
  if (intro) {
    const p = document.createElement('p');
    p.textContent = intro;
    cells.push(textRow(document, [p]));
  }

  element.querySelectorAll('.carousel').forEach((item) => {
    const srcImg = item.querySelector('img');
    if (!srcImg) return;

    const img = document.createElement('img');
    img.src = srcImg.src;
    img.alt = srcImg.getAttribute('alt') || srcImg.getAttribute('title') || '';

    const titleCell = document.createElement('div');
    item.querySelectorAll('.desc-wp p').forEach((srcP) => {
      const text = srcP.textContent.trim();
      if (!text) return;
      const p = document.createElement('p');
      p.textContent = text;
      titleCell.append(p);
    });

    const srcLink = item.querySelector('a[href]:not([href^="javascript"])');
    const link = document.createElement('a');
    if (srcLink) {
      link.href = srcLink.href;
      link.textContent = srcLink.href;
    }

    const options = [];
    if (item.classList.contains('selected')) options.push('selected');
    if (srcLink?.getAttribute('target') === '_blank') options.push('new tab');

    cells.push([img, titleCell, srcLink ? link : '', options.join(', ')]);
  });

  const footer = [];
  const description = container?.querySelector('.rte p:not(.d-none)');
  if (description?.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = description.textContent.replace(/\s+/g, ' ').trim();
    footer.push(p);
  }
  const cta = container?.querySelector('.cta a[href]');
  if (cta) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = cta.href;
    a.textContent = cta.textContent.trim();
    p.append(a);
    footer.push(p);
  }
  if (footer.length) cells.push(textRow(document, footer));

  element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
}
