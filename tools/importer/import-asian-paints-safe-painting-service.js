/* global WebImporter */
import circlefiltersParser from './parsers/circlefilters.js';

/**
 * Returns the last AEM title component heading that appears before the given element.
 * @param {Document} document The source document
 * @param {Element} element The reference element
 * @returns {Element|undefined} The heading
 */
function findPrecedingHeading(document, element) {
  return [...document.querySelectorAll('.title > :is(h1, h2, h3, h4, h5, h6)')]
    // eslint-disable-next-line no-bitwise
    .filter((h) => h.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
    .pop();
}

/**
 * Builds the /asian-paints-safe-painting-service page: a circlefilters block whose first row
 * is the "range of products" heading.
 */
export default {
  transform: ({ document, url }) => {
    const main = document.createElement('main');
    const source = document.querySelector('.circlefilters');

    if (source) {
      const block = source.cloneNode(true);
      main.append(block);
      circlefiltersParser(block, {
        document,
        url,
        heading: findPrecedingHeading(document, source),
        container: source.closest('.responsivegrid.padding45'),
      });
    }

    main.append(WebImporter.Blocks.getMetadataBlock(document, {
      Title: 'Safe Painting Service',
      Description: 'Explore our range of interior paints with the Asian Paints Safe Painting Service.',
    }));

    return [{
      element: main,
      path: '/asian-paints-safe-painting-service',
      report: {
        circlefilters: source ? 'found' : 'missing',
      },
    }];
  },
};
