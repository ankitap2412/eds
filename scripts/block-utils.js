/*
 * Helpers shared by blocks authored as tables in DA: labelled rows,
 * true/false cells, images and links.
 */

export const URL_PATTERN = /^(https?:\/\/|\/)\S*$/;
const IMAGE_URL_PATTERN = /^https?:\/\/\S+\.(avif|gif|jpe?g|png|svg|webp)(\?\S*)?$/i;

// Publishing rewrites links to the production domain into site-relative paths
// (and drops `.html`). Pages behind them still live on the AEM site.
const PRODUCTION_ORIGIN = 'https://www.asianpaints.com';

/**
 * Points site-relative links back at the production site when not running on it,
 * so preview links open the real page instead of a missing one.
 * @param {string} href The authored href
 * @returns {string} The resolved href
 */
export function resolveHref(href) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  if (window.location.origin === PRODUCTION_ORIGIN) return href;
  const url = new URL(href, PRODUCTION_ORIGIN);
  if (url.pathname !== '/' && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '.html';
  return url.href;
}

/**
 * Sets the link target. Cross-site links open in a new tab when the page is shown
 * inside a frame (e.g. an editor preview), because the target site refuses framing.
 * @param {HTMLAnchorElement} link The link
 * @param {boolean} newTab Whether the author asked for a new tab
 */
export function setTarget(link, newTab) {
  const crossSite = link.origin !== window.location.origin;
  if (newTab || (crossSite && window.self !== window.top)) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
}

/**
 * Matches a cell's text against a set of labels.
 * @param {Element} [cell] The cell
 * @param {Object<string, string[]>} labels Label key to accepted spellings
 * @returns {string|undefined} The matching label key
 */
export function labelOf(cell, labels) {
  const text = (cell?.textContent || '').trim().toLowerCase().replace(/[:*]/g, '').replace(/\s+/g, ' ');
  return Object.keys(labels).find((key) => labels[key].includes(text));
}

/**
 * Reads a true/false value cell.
 * @param {Element} [cell] The cell
 * @returns {boolean} Whether the cell says true/yes
 */
export function isTrue(cell) {
  return /^(true|yes|y|1)$/i.test(cell?.textContent.trim() || '');
}

/**
 * Reads the item image: an uploaded image, or a link/URL to an image file.
 * @param {Element} [cell] The cell (or row) holding the image
 * @returns {{ src: string, alt: string, optimize: boolean }|null}
 */
export function readImage(cell) {
  const img = cell?.querySelector('picture img');
  if (img) return { src: img.src, alt: img.alt, optimize: true };
  const url = cell?.querySelector('a[href]')?.getAttribute('href') || cell?.textContent.trim() || '';
  return IMAGE_URL_PATTERN.test(url) ? { src: url, alt: '', optimize: false } : null;
}

/**
 * Reads the link authored in the link cell, falling back to a linked title.
 * When the link text is a full URL it wins over the href, because publishing
 * rewrites links to the production domain into site-relative paths.
 * @param {Element} [linkCell] The link cell
 * @param {Element} [titleCell] The title cell
 * @returns {string} The href, or empty string when none is authored
 */
export function readHref(linkCell, titleCell) {
  const anchor = linkCell?.querySelector('a[href]') || titleCell?.querySelector('a[href]');
  if (anchor) {
    const text = anchor.textContent.trim();
    return /^https?:\/\/\S+$/.test(text) ? text : anchor.getAttribute('href');
  }
  const text = linkCell?.textContent.trim() || '';
  return URL_PATTERN.test(text) ? text : '';
}
