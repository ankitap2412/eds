/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-products.js
  var import_products_exports = {};
  __export(import_products_exports, {
    default: () => import_products_default
  });

  // tools/importer/parsers/wideimage.js
  function toAbsolute(src, baseUrl) {
    const url = new URL(src.split(/\s+/)[0], baseUrl);
    url.search = "";
    return url.href;
  }
  function createImg(document, src, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    return img;
  }
  function parse(element, { document, url }) {
    const picture = element.querySelector("picture");
    if (!picture) return;
    const fallback = picture.querySelector("img");
    const alt = (fallback == null ? void 0 : fallback.getAttribute("alt")) || "";
    const desktopSource = picture.querySelector('source[media*="min-width"]');
    const mobileSource = picture.querySelector('source[media*="max-width"]');
    const desktopSrc = toAbsolute(
      (desktopSource == null ? void 0 : desktopSource.getAttribute("srcset")) || fallback.getAttribute("src"),
      url
    );
    const mobileSrc = mobileSource ? toAbsolute(mobileSource.getAttribute("srcset"), url) : desktopSrc;
    const imageRow = [createImg(document, desktopSrc, alt), createImg(document, mobileSrc, alt)];
    const cells = [["Wideimage"], imageRow];
    const anchor = element.querySelector("a[href]");
    if (anchor) {
      const href = new URL(anchor.getAttribute("href"), url).href;
      const link = document.createElement("a");
      link.href = href;
      link.textContent = href;
      cells.push([link]);
    }
    const table = WebImporter.DOMUtils.createTable(cells, document);
    element.replaceWith(table);
  }

  // tools/importer/import-products.js
  var import_products_default = {
    transform: ({ document, url }) => {
      const main = document.createElement("main");
      const banner = document.querySelector(".store-banner");
      if (banner) {
        const block = banner.cloneNode(true);
        main.append(block);
        parse(block, { document, url });
      }
      const meta = WebImporter.Blocks.getMetadataBlock(document, {
        Title: "Products",
        Description: "Explore our products."
      });
      main.append(meta);
      return [{
        element: main,
        path: "/products",
        report: { wideimage: banner ? "found" : "missing" }
      }];
    }
  };
  return __toCommonJS(import_products_exports);
})();
