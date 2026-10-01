/* global WebImporter */
import wideimageParser from './parsers/wideimage.js';

/**
 * Builds the /products page: a single wideimage block taken from the
 * reference banner on the source page.
 */
export default {
  transform: ({ document, url }) => {
    const main = document.createElement('main');
    const banner = document.querySelector('.store-banner');

    if (banner) {
      const block = banner.cloneNode(true);
      main.append(block);
      wideimageParser(block, { document, url });
    }

    const meta = WebImporter.Blocks.getMetadataBlock(document, {
      Title: 'Products',
      Description: 'Explore our products.',
    });
    main.append(meta);

    return [{
      element: main,
      path: '/products',
      report: { wideimage: banner ? 'found' : 'missing' },
    }];
  },
};
