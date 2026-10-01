import { createOptimizedPicture } from '../../scripts/aem.js';

const DESKTOP_MEDIA = '(min-width: 768px)';

/**
 * Finds the link target authored in the block.
 * Accepts a linked cell or a plain-text URL/path in a cell without an image.
 * When the link text is a full URL it wins over the href, because publishing
 * rewrites links to the production domain into site-relative paths.
 * @param {Element} block The block element
 * @returns {string} The href, or empty string when none is authored
 */
function findHref(block) {
  const anchor = block.querySelector('a[href]');
  if (anchor) {
    const text = anchor.textContent.trim();
    return /^https?:\/\/\S+$/.test(text) ? text : anchor.getAttribute('href');
  }

  const cell = [...block.querySelectorAll(':scope > div > div')]
    .filter((c) => !c.querySelector('picture'))
    .map((c) => c.textContent.trim())
    .find((text) => /^(https?:\/\/|\/|#)\S*$/.test(text));
  return cell || '';
}

/**
 * Builds an art-directed picture that swaps between desktop and mobile images.
 * @param {HTMLImageElement} desktop Desktop image
 * @param {HTMLImageElement} mobile Mobile image
 * @param {string} alt Alternative text
 * @param {boolean} eager Whether to load eagerly
 * @returns {Element} The picture element
 */
function buildPicture(desktop, mobile, alt, eager) {
  if (!desktop || !mobile) {
    return createOptimizedPicture((desktop || mobile).src, alt, eager);
  }

  const picture = createOptimizedPicture(mobile.src, alt, eager, [{ width: '750' }]);
  const desktopSources = createOptimizedPicture(
    desktop.src,
    alt,
    eager,
    [{ media: DESKTOP_MEDIA, width: '2000' }, { width: '750' }],
  ).querySelectorAll('source[media]');
  picture.prepend(...desktopSources);
  return picture;
}

/**
 * Decorates the wideimage block.
 * Row 1: desktop image | mobile image. Row 2: link URL.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const images = [...block.querySelectorAll('picture img')];
  const [desktop, mobile] = images;
  if (!desktop) {
    block.textContent = '';
    return;
  }

  const alt = desktop.alt || mobile?.alt || '';
  const eager = block.closest('.section') === block.closest('main')?.querySelector('.section');
  const picture = buildPicture(desktop, mobile, alt, eager);
  const href = findHref(block);

  let content = picture;
  if (href) {
    content = document.createElement('a');
    content.className = 'wideimage-link';
    content.href = href;
    if (alt) content.setAttribute('aria-label', alt);
    content.append(picture);
  }

  block.replaceChildren(content);
}
