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

  // tools/importer/import-asian-paints-safe-painting-service.js
  var import_asian_paints_safe_painting_service_exports = {};
  __export(import_asian_paints_safe_painting_service_exports, {
    default: () => import_asian_paints_safe_painting_service_default
  });

  // tools/importer/parsers/circlefilters.js
  function variantName(element) {
    if (element.querySelector(".apHomes-circleFilter-Variant")) return "Circlefilters (carousel)";
    if (element.querySelector(".service-circular-container-wp")) return "Circlefilters (service)";
    return "Circlefilters";
  }
  function link(document, href, text) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    return a;
  }
  function parse(element, {
    document,
    heading,
    container = element.closest(".responsivegrid.padding45")
  }) {
    var _a, _b;
    const cells = [[variantName(element)]];
    if (heading) {
      const h = document.createElement(heading.tagName.toLowerCase());
      const text = heading.textContent.replace(/\s+/g, " ").trim();
      const srcLink = heading.querySelector("a[href]");
      if (srcLink) h.append(link(document, srcLink.href, text));
      else h.textContent = text;
      cells.push(["Title", h]);
    }
    const subtitle = (_a = element.querySelector(".description-area .desc")) == null ? void 0 : _a.textContent.trim();
    if (subtitle) cells.push(["Sub title", subtitle]);
    const description = (_b = container == null ? void 0 : container.querySelector(".rte p:not(.d-none)")) == null ? void 0 : _b.textContent.replace(/\s+/g, " ").trim();
    if (description) cells.push(["Description", description]);
    const cta = container == null ? void 0 : container.querySelector(".cta a[href]");
    if (cta) {
      cells.push(["CTA", link(document, cta.href, cta.textContent.trim())]);
      cells.push(["Open in new tab", cta.getAttribute("target") === "_blank" ? "true" : "false"]);
    }
    cells.push(["Image", "Name", "Page link", "Selected", "Open in new tab"]);
    element.querySelectorAll(".carousel").forEach((item) => {
      const srcImg = item.querySelector("img");
      if (!srcImg) return;
      const img = document.createElement("img");
      img.src = srcImg.src;
      img.alt = srcImg.getAttribute("alt") || srcImg.getAttribute("title") || "";
      const nameCell = document.createElement("div");
      item.querySelectorAll(".desc-wp p").forEach((srcP) => {
        const text = srcP.textContent.trim();
        if (!text) return;
        const p = document.createElement("p");
        p.textContent = text;
        nameCell.append(p);
      });
      const srcLink = item.querySelector('a[href]:not([href^="javascript"])');
      cells.push([
        img,
        nameCell,
        srcLink ? link(document, srcLink.href, srcLink.href) : "",
        item.classList.contains("selected") ? "true" : "false",
        (srcLink == null ? void 0 : srcLink.getAttribute("target")) === "_blank" ? "true" : "false"
      ]);
    });
    element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
  }

  // tools/importer/import-asian-paints-safe-painting-service.js
  function findPrecedingHeading(document, element) {
    return [...document.querySelectorAll(".title > :is(h1, h2, h3, h4, h5, h6)")].filter((h) => h.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
  }
  var import_asian_paints_safe_painting_service_default = {
    transform: ({ document, url }) => {
      const main = document.createElement("main");
      const source = document.querySelector(".circlefilters");
      if (source) {
        const block = source.cloneNode(true);
        main.append(block);
        parse(block, {
          document,
          url,
          heading: findPrecedingHeading(document, source),
          container: source.closest(".responsivegrid.padding45")
        });
      }
      main.append(WebImporter.Blocks.getMetadataBlock(document, {
        Title: "Safe Painting Service",
        Description: "Explore our range of interior paints with the Asian Paints Safe Painting Service."
      }));
      return [{
        element: main,
        path: "/asian-paints-safe-painting-service",
        report: {
          circlefilters: source ? "found" : "missing"
        }
      }];
    }
  };
  return __toCommonJS(import_asian_paints_safe_painting_service_exports);
})();
