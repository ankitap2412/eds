/* global WebImporter */
import exploreStoreParser from './parsers/explore-store.js';

/**
 * Builds the /store-locator page: the "Explore Our Stores" explore-store block.
 */
export default {
  transform: ({ document, url }) => {
    const main = document.createElement('main');
    const source = document.querySelector('.explore-store');

    if (source) {
      const block = source.cloneNode(true);
      main.append(block);
      exploreStoreParser(block, { document, url });
    }

    main.append(WebImporter.Blocks.getMetadataBlock(document, {
      Title: 'Store Locator',
      Description: 'Find an Asian Paints store near you and explore our store formats.',
    }));

    return [{
      element: main,
      path: '/store-locator',
      report: { 'explore-store': source ? 'found' : 'missing' },
    }];
  },
};
