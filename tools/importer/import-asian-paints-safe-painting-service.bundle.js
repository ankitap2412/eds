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
  function textRow(document, paragraphs) {
    const cell = document.createElement("div");
    paragraphs.forEach((p) => cell.append(p));
    return [cell];
  }
  function parse(element, { document, container = element.closest(".responsivegrid.padding45") }) {
    var _a;
    const cells = [[variantName(element)]];
    const intro = (_a = element.querySelector(".description-area .desc")) == null ? void 0 : _a.textContent.trim();
    if (intro) {
      const p = document.createElement("p");
      p.textContent = intro;
      cells.push(textRow(document, [p]));
    }
    element.querySelectorAll(".carousel").forEach((item) => {
      const srcImg = item.querySelector("img");
      if (!srcImg) return;
      const img = document.createElement("img");
      img.src = srcImg.src;
      img.alt = srcImg.getAttribute("alt") || srcImg.getAttribute("title") || "";
      const titleCell = document.createElement("div");
      item.querySelectorAll(".desc-wp p").forEach((srcP) => {
        const text = srcP.textContent.trim();
        if (!text) return;
        const p = document.createElement("p");
        p.textContent = text;
        titleCell.append(p);
      });
      const srcLink = item.querySelector('a[href]:not([href^="javascript"])');
      const link = document.createElement("a");
      if (srcLink) {
        link.href = srcLink.href;
        link.textContent = srcLink.href;
      }
      const options = [];
      if (item.classList.contains("selected")) options.push("selected");
      if ((srcLink == null ? void 0 : srcLink.getAttribute("target")) === "_blank") options.push("new tab");
      cells.push([img, titleCell, srcLink ? link : "", options.join(", ")]);
    });
    const footer = [];
    const description = container == null ? void 0 : container.querySelector(".rte p:not(.d-none)");
    if (description == null ? void 0 : description.textContent.trim()) {
      const p = document.createElement("p");
      p.textContent = description.textContent.replace(/\s+/g, " ").trim();
      footer.push(p);
    }
    const cta = container == null ? void 0 : container.querySelector(".cta a[href]");
    if (cta) {
      const p = document.createElement("p");
      const a = document.createElement("a");
      a.href = cta.href;
      a.textContent = cta.textContent.trim();
      p.append(a);
      footer.push(p);
    }
    if (footer.length) cells.push(textRow(document, footer));
    element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
  }

  // tools/importer/parsers/title.js
  var ALIGNMENTS = { centerAlign: "center", rightAlign: "right" };
  var DEFAULT_COLORS = ["#000", "#000000", "rgb(0, 0, 0)"];
  function parse2(element, { document }) {
    const alignment = Object.keys(ALIGNMENTS).find((cls) => element.classList.contains(cls));
    const name = alignment ? `Title (${ALIGNMENTS[alignment]})` : "Title";
    const heading = document.createElement(element.tagName.toLowerCase());
    const text = element.textContent.replace(/\s+/g, " ").trim();
    const srcLink = element.querySelector("a[href]");
    if (srcLink) {
      const a = document.createElement("a");
      a.href = srcLink.href;
      a.textContent = text;
      heading.append(a);
    } else {
      heading.textContent = text;
    }
    const cells = [[name], [heading]];
    const color = element.style.color.trim();
    if (color && !DEFAULT_COLORS.includes(color.toLowerCase())) cells.push([color]);
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
        const heading = findPrecedingHeading(document, source);
        if (heading) {
          const title = heading.cloneNode(true);
          main.append(title);
          parse2(title, { document, url });
        }
        const block = source.cloneNode(true);
        main.append(block);
        parse(block, {
          document,
          url,
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
          title: main.querySelector("table") ? "found" : "missing",
          circlefilters: source ? "found" : "missing"
        }
      }];
    }
  };
  return __toCommonJS(import_asian_paints_safe_painting_service_exports);
})();
