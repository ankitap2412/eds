# edspoc-stg handoff

Updated copies of edspoc-stg (`aemedsap/edspoc-stg`) block files, to copy into that
project's `eds/blocks/` folder. They are not used by this site: they import modules that only
exist in edspoc-stg, so `tools/edspoc-stg` is excluded from linting, and `tools/` is not published.

| File | Change |
|------|--------|
| `blocks/service-steps/service-steps.js` | "Book a FREE Site Visit" opens the site-visit pop-up when the button links to the safe painting service page in any form (`/services/asian-paints-safe-painting-service`, the AEM path `/content/ap/en/home/services/...`, with or without `.html`). Before, only the exact `/services/...` path did, so the AEM-path link opened a 404 in a new tab. Also removes a leftover `console.log`. |
| `blocks/wallpaint-tool/wallpaint-tool.js` | "Download PDF" (Step 3) builds the source's recommendations PDF for the tab on screen: user details from the lead form, range banner, products, waterproofing product, services. jQuery-free: html2canvas + jsPDF from `scripts/vendor` load on the first click; images come from `static.asianpaints.com`, which allows the cross-origin reads. Optional Step 3 rows: `PDF File Name`, `PDF Logo`, `PDF Header Description`, `PDF Disclaimer`, `PDF Footer`. |
| `blocks/wallpaint-tool/wallpaint-tool.js` + `.css` (loader) | As the source, a "↻" spins after the arrow while "View Recommendations" saves the lead and loads the results, and while "Download PDF" builds the file (`setButtonLoading`, `.wallpainttool-loader`, `.is-loading`). Based on beta's current files (incl. its link-option change). |
| `blocks/form-banner/form-banner.css` | Both BHPS questions shown (desktop): the form card is centred with equal space above and below it, still on the right. The image area fills the banner instead of a fixed 580px height. |

Tested on edspoc-stg pages:
- `/resources/tools/paint-finish-tool` (service-steps)
- `/services/asian-paints-safe-painting-service/interior-paints-and-textures` (form-banner)
- beta.asianpaints.com `/resources/tools/paint-finish-tool` (wallpaint-tool: PDF for the Luxury, Premium and Economy tabs)
