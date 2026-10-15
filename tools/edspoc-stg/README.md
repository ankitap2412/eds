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
| `blocks/similar-products/similar-products.css` | As the source: the heart is the source's sprite icon (`Icons-Sprite.webp`, outline/filled), cards sized like its slides (413px at 1920, 426px at 1440), product name 42px under the image, VIEW ALL (600 weight) on the title's lower edge. JS unchanged. |
| `blocks/form-banner/form-banner.css` | Both BHPS questions shown (desktop): the form card is centred with equal space above and below it, still on the right. The image area fills the banner instead of a fixed 580px height. |

Tested on edspoc-stg pages:
- `/resources/tools/paint-finish-tool` (service-steps)
- `/services/asian-paints-safe-painting-service/interior-paints-and-textures` (form-banner)
- beta.asianpaints.com `/resources/tools/paint-finish-tool` (wallpaint-tool: PDF for the Luxury, Premium and Economy tabs)
