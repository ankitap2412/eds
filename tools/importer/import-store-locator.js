/* global WebImporter */
import exploreStoreCardsParser from './parsers/explore-store-cards.js';

/**
 * Builds the /store-locator page: the "Explore Our Stores" explore-store-cards block.
 */
export default {
  transform: ({ document, url }) => {
    const main = document.createElement('main');
    const source = document.querySelector('.explore-store');

    if (source) {
      const block = source.cloneNode(true);
      main.append(block);
      exploreStoreCardsParser(block, { document, url });
    }

    main.append(WebImporter.Blocks.getMetadataBlock(document, {
      Title: 'Store Locator',
      Description: 'Find an Asian Paints store near you and explore our store formats.',
    }));

    return [{
      element: main,
      path: '/store-locator',
      report: { 'explore-store-cards': source ? 'found' : 'missing' },
    }];
  },
};
