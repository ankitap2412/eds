/* global WebImporter */

/**
 * Parser for the wideimage block.
 * Source: a linked banner <picture> with separate desktop and mobile <source>s
 * (e.g. asianpaints.com `.store-banner`).
 * Output rows: [Wideimage] / [desktop image | mobile image] / [link URL]
 */
function toAbsolute(src, baseUrl) {
  const url = new URL(src.split(/\s+/)[0], baseUrl);
  url.search = '';
  return url.href;
}

function createImg(document, src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  return img;
}

export default function parse(element, { document, url }) {
  const picture = element.querySelector('picture');
  if (!picture) return;

  const fallback = picture.querySelector('img');
  const alt = fallback?.getAttribute('alt') || '';
  const desktopSource = picture.querySelector('source[media*="min-width"]');
  const mobileSource = picture.querySelector('source[media*="max-width"]');

  const desktopSrc = toAbsolute(
    desktopSource?.getAttribute('srcset') || fallback.getAttribute('src'),
    url,
  );
  const mobileSrc = mobileSource
    ? toAbsolute(mobileSource.getAttribute('srcset'), url)
    : desktopSrc;

  const imageRow = [createImg(document, desktopSrc, alt), createImg(document, mobileSrc, alt)];
  const cells = [['Wideimage'], imageRow];

  const anchor = element.querySelector('a[href]');
  if (anchor) {
    const { href } = new URL(anchor.getAttribute('href'), url);
    const link = document.createElement('a');
    link.href = href;
    link.textContent = href;
    cells.push([link]);
  }

  const table = WebImporter.DOMUtils.createTable(cells, document);
  element.replaceWith(table);
}
