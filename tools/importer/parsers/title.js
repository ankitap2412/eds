/* global WebImporter */

/**
 * Parser for the title block.
 * Source: AEM title component (`.title > h1-h6.leftAlign|centerAlign|rightAlign`).
 * Output rows: [Title (alignment)] / [heading, optionally linked]
 *   / [colour] (only when not the default black)
 */
const ALIGNMENTS = { centerAlign: 'center', rightAlign: 'right' };
const DEFAULT_COLORS = ['#000', '#000000', 'rgb(0, 0, 0)'];

export default function parse(element, { document }) {
  const alignment = Object.keys(ALIGNMENTS).find((cls) => element.classList.contains(cls));
  const name = alignment ? `Title (${ALIGNMENTS[alignment]})` : 'Title';

  const heading = document.createElement(element.tagName.toLowerCase());
  const text = element.textContent.replace(/\s+/g, ' ').trim();
  const srcLink = element.querySelector('a[href]');
  if (srcLink) {
    const a = document.createElement('a');
    a.href = srcLink.href;
    a.textContent = text;
    heading.append(a);
  } else {
    heading.textContent = text;
  }

  const cells = [[name], [heading]];
  const color = element.style.color.trim();
  if (color && !DEFAULT_COLORS.includes(color.toLowerCase())) cells.push([color]);

  element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
}
