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

  // tools/importer/parsers/circle-filters.js
  function variantName(element) {
    if (element.querySelector(".apHomes-circleFilter-Variant")) return "Circle Filters (carousel)";
    if (element.querySelector(".service-circular-container-wp")) return "Circle Filters (service)";
    return "Circle Filters";
  }
  function link(document, href, text2) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text2;
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
      const text2 = heading.textContent.replace(/\s+/g, " ").trim();
      const srcLink = heading.querySelector("a[href]");
      if (srcLink) h.append(link(document, srcLink.href, text2));
      else h.textContent = text2;
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
        const text2 = srcP.textContent.trim();
        if (!text2) return;
        const p = document.createElement("p");
        p.textContent = text2;
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

  // tools/importer/parsers/choose-plan.js
  var text = (el) => (el == null ? void 0 : el.textContent.replace(/\s+/g, " ").trim()) || "";
  function parse2(element, { document, url }) {
    const cells = [["Choose Plan (choose-plan-v2)"]];
    const title = text(element.querySelector(".choosePlanBlock__wrapper--title"));
    if (title) {
      const h2 = document.createElement("h2");
      h2.textContent = title;
      cells.push([h2]);
    }
    element.querySelectorAll(".choosePlanBlock__wrapper--banners--cards").forEach((card) => {
      const nameCell = document.createElement("div");
      const srcImg = card.querySelector(".choosePlanBlock__wrapper--banners--cards__iconAndText img");
      if (srcImg == null ? void 0 : srcImg.getAttribute("src")) {
        const img = document.createElement("img");
        img.src = new URL(srcImg.getAttribute("src"), url).href;
        img.alt = "";
        nameCell.append(img);
      }
      const name = document.createElement("p");
      name.textContent = text(card.querySelector(".main-sub-title"));
      nameCell.append(name);
      const features = document.createElement("div");
      card.querySelectorAll(".choosePlanBlock__wrapper--banners--cards--lists").forEach((group) => {
        const label = text(group.querySelector(".sub-title"));
        if (label) {
          const p = document.createElement("p");
          p.textContent = label;
          features.append(p);
        }
        const ul = document.createElement("ul");
        group.querySelectorAll("li").forEach((srcLi) => {
          const li = document.createElement("li");
          li.textContent = text(srcLi);
          ul.append(li);
        });
        if (ul.children.length) features.append(ul);
      });
      const ctaCell = document.createElement("div");
      const srcLink = card.querySelector(".bookThisPlan a[href]");
      if (srcLink) {
        const a = document.createElement("a");
        a.href = srcLink.getAttribute("href");
        a.textContent = text(srcLink);
        ctaCell.append(a);
      }
      cells.push([nameCell, features, ctaCell]);
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
      const plans = document.querySelector(".choosePlanBlock");
      if (plans) {
        main.append(document.createElement("hr"));
        const block = plans.cloneNode(true);
        main.append(block);
        parse2(block, { document, url });
      }
      main.append(WebImporter.Blocks.getMetadataBlock(document, {
        Title: "Safe Painting Service",
        Description: "Explore our range of interior paints with the Asian Paints Safe Painting Service."
      }));
      return [{
        element: main,
        path: "/asian-paints-safe-painting-service",
        report: {
          "circle-filters": source ? "found" : "missing",
          "choose-plan": plans ? "found" : "missing"
        }
      }];
    }
  };
  return __toCommonJS(import_asian_paints_safe_painting_service_exports);
})();
