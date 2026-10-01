import { getMetadata } from '../../scripts/aem.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Finds an authored colour value (e.g. `#ffffff`, `rgb(0 0 0)`, `white`)
 * in the rows after the title.
 * @param {Element[]} rows The rows after the title row
 * @returns {string} The colour, or empty string when none is authored
 */
function findColor(rows) {
  return rows
    .flatMap((row) => [...row.children])
    .map((cell) => cell.textContent.trim())
    .find((text) => text && CSS.supports('color', text)) || '';
}

/**
 * Decorates the title block.
 * Row 1: the title (heading level = type, linked text = link). Empty uses the page title.
 * Row 2 (optional): text colour.
 * Alignment comes from the block options: (center) or (right). Default is left.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [titleRow, ...rest] = [...block.children];
  const heading = titleRow?.querySelector(HEADINGS);
  const anchor = titleRow?.querySelector('a[href]');
  const text = (heading || titleRow)?.textContent.trim()
    || getMetadata('og:title')
    || document.title;

  if (!text) {
    block.textContent = '';
    return;
  }

  const element = document.createElement(heading ? heading.tagName.toLowerCase() : 'h2');
  element.className = 'title-heading';
  if (heading?.id) element.id = heading.id;

  const color = findColor(rest);
  if (color) element.style.color = color;

  if (anchor) {
    const link = document.createElement('a');
    link.href = anchor.getAttribute('href');
    link.textContent = text;
    element.append(link);
  } else {
    element.textContent = text;
  }

  block.replaceChildren(element);
}
