# edspoc-stg handoff

Updated copies of edspoc-stg (`aemedsap/edspoc-stg`) block files, to copy into that
project's `eds/blocks/` folder. They are not used by this site: they import modules that only
exist in edspoc-stg, so `tools/edspoc-stg` is excluded from linting, and `tools/` is not published.

| File | Change |
|------|--------|
| `blocks/service-steps/service-steps.js` | "Book a FREE Site Visit" opens the site-visit pop-up when the button links to the safe painting service page in any form (`/services/asian-paints-safe-painting-service`, the AEM path `/content/ap/en/home/services/...`, with or without `.html`). Before, only the exact `/services/...` path did, so the AEM-path link opened a 404 in a new tab. Also removes a leftover `console.log`. |
| `blocks/wallpaint-tool/wallpaint-tool.js` | "Download PDF" (Step 3) builds the source's recommendations PDF for the tab on screen: user details from the lead form, range banner, products, waterproofing product, services. jQuery-free: html2canvas + jsPDF from `scripts/vendor` load on the first click; images come from `static.asianpaints.com`, which allows the cross-origin reads. Optional Step 3 rows: `PDF File Name`, `PDF Logo`, `PDF Header Description`, `PDF Disclaimer`, `PDF Footer`. |
| `blocks/wallpaint-tool/wallpaint-tool.js` + `.css` (loader) | As the source, a "↻" spins after the arrow while "View Recommendations" saves the lead and loads the results, and while "Download PDF" builds the file (`setButtonLoading`, `.wallpainttool-loader`, `.is-loading`). Based on beta's current files (incl. its link-option change). |
| `blocks/calculatorhub/calculatorhub.css` | Same dimensions and button alignment as the source at every width: panel capped at 1325px, source paddings (incl. 1280-1366 and 993-1200 sizes), area label above the input, button centred on the input (overrides the `.cta { margin-bottom: 100px }` the wrapper inherited), 90px tiles / 195px button at 993-1200px. JS unchanged. |
| `blocks/similar-products/similar-products.css` + `icons/wishlist.svg`, `icons/wishlist-filled.svg` | As the source: the heart is the source's `.favouriteIcon` redrawn as SVG (40px white circle, 19x15 heart; outline at rest, solid red when added, swapped on `aria-pressed`), cards sized like its slides (413px at 1920, 426px at 1440), product name 42px under the image, VIEW ALL (600 weight) on the title's lower edge. Icons go in `eds/icons/`. JS unchanged. |
| `blocks/two-column-image/two-column-image.js` + `.css` | New `tools-redirection` variant for the calculator banners on product pages, as the source's tools-redirection-parent: images fill the column width at the height of the shortest image file (241px desktop / 122px mobile here), 8px corners, 10px apart when stacked, gutters 4.5% mobile / min(4%, 57.6px) desktop so the row is 1325px wide on wide screens. DA: `Two Column Image (tools-redirection)`. Default block unchanged. |
| `blocks/switch-image/switch-image.css` | Benefits tabs as the source: 1440px column with 57.6px gutters from 992px (4.5% below), so the image is 1325px wide and the tiles 442x90 with the text wrapping the same; mobile/tablet tabs 60px tall, 15px lines, text 90% of the tab centred with 20px kept on the right; open tab 600 weight. JS unchanged. |
| `blocks/banner-float/banner-float.css` | "Explore more at our stores" as the source: the white/grey band inside the page gutters of a 1440px column (341px at 375, 1325px at 1440, 1286px at 1920), photo inset 105px from 768px, 30px/70px below the band; heading and CTA in 700 (the source's 600 renders Bold, it loads no Manrope 600); fixes the next-section selector (`similar-products-container`). ids-type-variant unchanged. |
| `blocks/colour-explorer/colour-explorer.css` | Popular Shades desktop as the source: the stage is the page's 1440px column, centred (was a 4% wrapper margin cancelled by a -4% block margin, which left ~5px extra each side at 1440 and shifted the block 234px left at 1920). Mobile unchanged. |
| `blocks/form-banner/form-banner.css` | Both BHPS questions shown (desktop): the form card is centred with equal space above and below it, still on the right. The image area fills the banner instead of a fixed 580px height. |

Tested on edspoc-stg pages:
- `/resources/tools/paint-finish-tool` (service-steps)
- `/services/asian-paints-safe-painting-service/interior-paints-and-textures` (form-banner)
- beta.asianpaints.com `/resources/tools/paint-finish-tool` (wallpaint-tool: PDF for the Luxury, Premium and Economy tabs)
