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

  // tools/importer/import-store-locator.js
  var import_store_locator_exports = {};
  __export(import_store_locator_exports, {
    default: () => import_store_locator_default
  });

  // tools/importer/parsers/explore-store.js
  var text = (el) => (el == null ? void 0 : el.textContent.replace(/\s+/g, " ").trim()) || "";
  function parse(element, { document, url }) {
    const name = element.classList.contains("bhps-whychoos") ? "Explore Store (bhps)" : "Explore Store";
    const cells = [[name]];
    const title = text(element.querySelector(".our-services-title"));
    if (title) cells.push(["Title", title]);
    const subtitle = text(element.querySelector(".our-services-subheading"));
    if (subtitle) cells.push(["Sub title", subtitle]);
    cells.push(["Icon", "Title", "Description", "Link", "Border colour"]);
    element.querySelectorAll(".explore-card").forEach((card) => {
      var _a;
      const srcImg = card.querySelector("img");
      let icon = "";
      if (srcImg == null ? void 0 : srcImg.getAttribute("src")) {
        icon = document.createElement("img");
        icon.src = new URL(srcImg.getAttribute("src"), url).href;
        icon.alt = "";
      }
      const srcLink = card.querySelector("a[href]");
      let link = "";
      if (srcLink) {
        link = document.createElement("a");
        link.href = new URL(srcLink.getAttribute("href"), url).href;
        link.textContent = link.href;
      }
      const border = ((_a = (card.getAttribute("style") || "").match(/border-bottom-color:\s*([^;]+)/i)) == null ? void 0 : _a[1].trim()) || "";
      cells.push([
        icon,
        text(card.querySelector(".explore-card-title")),
        text(card.querySelector(".explore-card-desc")),
        link,
        border
      ]);
    });
    element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
  }

  // tools/importer/import-store-locator.js
  var import_store_locator_default = {
    transform: ({ document, url }) => {
      const main = document.createElement("main");
      const source = document.querySelector(".explore-store");
      if (source) {
        const block = source.cloneNode(true);
        main.append(block);
        parse(block, { document, url });
      }
      main.append(WebImporter.Blocks.getMetadataBlock(document, {
        Title: "Store Locator",
        Description: "Find an Asian Paints store near you and explore our store formats."
      }));
      return [{
        element: main,
        path: "/store-locator",
        report: { "explore-store": source ? "found" : "missing" }
      }];
    }
  };
  return __toCommonJS(import_store_locator_exports);
})();
