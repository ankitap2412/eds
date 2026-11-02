import {
  createOptimizedPicture, loadCSS, toClassName,
} from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { BETA_DOMAIN, PROD_DOMAIN } from '../../scripts/environment.js';
import { pushAdobeProductTitleClick } from '../../scripts/analytics_1.js';
import initWishlist, { wishlistHeart } from '../../scripts/wishlist.js';
import {
  loadJson, normalizeProduct, productsOf, sheetRows, filterGroupsFromProducts,
} from './product-data.js';

/**
 * Products Listing: the product listing of the listing pages (the source's listing-products-cards
 * on /paint-products/interior-wall-paints/plain-finishes), one block for the whole listing: every
 * range (Nilaya, Royale, Apcolite, Tractor…) is a group of cards under its heading, with the
 * price note under it, each in a section of its own (the block adds the sections after its
 * own, with its section's styles), as the separate range sections were.
 *
 * Authoring (a labelled table; every part optional):
 *   | Products Listing |                                   |
 *   | Data         | /eds/products.json                | the JSON fallback (DA sheet / workbook)
 *   | Products API | (the AEM endpoint, when exposed)  | tried first
 *   | Tax note     | (Inclusive of all taxes) per L*   | under each price
 *   | Filters and compare | Yes                        | adds the filter and compare bar
 *   | Compare page | /paint-products/interior-wall-paints/compare-products |
 *   | Compare limit | 3                                |
 *   | Compare label | Compare Products (the default)   | the compare button's text
 *   | Compare title | (the label, by default)          | the compare panel's heading
 *   | Compare data | /eds/products.json (the default)  | the compare panel's products: all
 *                                                         products, on every page
 *   | Filter group | Options order                     | the groups shown, in order
 *   | range        | premium, luxury, economy          | its options' order
 *   | Range        | Heading                           | Logo (compare panel) | Note
 *   | Nilaya       | Super Luxury Interior Wall Paints | (image)  | *The price per litre is …
 *     (Note: the text under that range; a range without one takes the table's `Note` row, if
 *     any: | Note | … |, the former note for every range)
 *   | Promo range | Desktop image | Mobile image | Image alt | Link | Desktop position |
 *     Mobile position |   (one row per range's promo)
 *   | Royale      | (image)       | (image)      | …         | …    | 11               | 11 |
 *   | Code | Name | Brand | Image | URL | Badge | Features | Price | Popularity | Filters |
 *     (optional product rows)
 *
 * Products come from the Products API if it answers, else the product rows of the table, else
 * the Data file, in one request for the page (product-data.js; the API may answer in the source's
 * data-attr-alldata shape). Ranges follow the Range rows, and only those are listed (a range page
 * shows its range also when the data has all the products); without Range rows, the data's
 * `brands` list (the source's data-attr-brands) or `ranges` sheet, then any other range of the
 * products, titled "<brand> Interior Wall Paints". Products of a range are in popularity order.
 * The compare panel lists all the products (see compareProducts), each range under its logo:
 * the Range row's, else a `| Compare range | Logo |` row's (for ranges the page doesn't list),
 * else the data's.
 *
 * Promos: one row per promo, in its range's grid. A position is the tile's place (1-based); an
 * empty one is the range's numField in the data, if any. Desktop (6 columns): the tile covers
 * the rest of its row and the next cards start the next row; in the row after the last card the
 * place keeps its column; 0 or further: after the cards. Phones (2 columns): one card wide at its
 * place (empty: the desktop position). The image links to the Link; promos hide while the listing
 * is filtered. A row without an image shows nothing (a range's slot, kept for later).
 *
 * Filters and compare: with `Filters and compare | Yes` the block adds the filter and compare bar
 * (./compare-products-panel.js and .css: the bar, filter panel and compare panel) in a section before
 * the listing, with its data from the same products: the filter groups and values are those of
 * all the products (the Filter group rows pick and order the groups and their options, as the
 * source's), the compare panel lists every range with its Logo. Groups slide open and closed as
 * on the source. Cards then carry a Compare checkbox; their data attributes (code, name, filter
 * values) are what the bar filters and compares.
 *
 * Cards carry a wishlist heart (scripts/wishlist.js). The block announces its render with
 * `product-cards:loaded` on the document.
 */

const DESKTOP_COLUMNS = 6;
const MOBILE_COLUMNS = 2;
const DATA = '/eds/products.json';
const TAX_NOTE = '(Inclusive of all taxes) per L*';

// links go to the live Asian Paints pages (www), and to beta only on pages served from beta
// (domains from scripts/environment.js)
const SITE_DOMAIN = window.location.hostname === BETA_DOMAIN ? BETA_DOMAIN : PROD_DOMAIN;
const ASIAN_PAINTS_HOSTS = [PROD_DOMAIN, BETA_DOMAIN, 'asianpaints.com'];

/**
 * An Asian Paints page URL on the site's domain (SITE_DOMAIN). Site-relative links (which the
 * content sync makes of authored www links) and www/beta.asianpaints.com links get that domain,
 * with the .html the site uses; other links are kept.
 * @param {string} href The link as authored or from the API
 * @param {string} [resolved] The browser-resolved link, used for links to other sites
 */
function siteUrl(href, resolved = href) {
  const relative = href.startsWith('/') && !href.startsWith('//');
  let url;
  try {
    url = new URL(relative ? href : resolved, `https://${SITE_DOMAIN}`);
  } catch (e) {
    return resolved;
  }
  if (!relative && !ASIAN_PAINTS_HOSTS.includes(url.hostname)) return resolved;
  url.protocol = 'https:';
  url.hostname = SITE_DOMAIN;
  if (url.pathname !== '/' && !/\.[a-z0-9]+$/i.test(url.pathname)) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}.html`;
  }
  return url.href;
}

// wraps each "*" footnote mark so it can be coloured like the source
function markFootnotes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.includes('*')) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const parts = node.nodeValue.split('*');
    const fragment = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i) {
        const mark = document.createElement('span');
        mark.className = 'products-listing-mark';
        mark.textContent = '*';
        fragment.append(mark);
      }
      if (part) fragment.append(part);
    });
    node.replaceWith(fragment);
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/* ---------- the block table ---------- */

const key = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cellText = (cell) => (cell?.textContent || '').replace(/\s+/g, ' ').trim();
const cellLink = (cell) => cell?.querySelector('a[href]')?.getAttribute('href') || cellText(cell);
const cellImage = (cell) => {
  const img = cell?.querySelector('img');
  return img ? {
    src: img.src,
    alt: (img.getAttribute('alt') || '').trim(),
    width: img.getAttribute('width'),
    height: img.getAttribute('height'),
  } : null;
};

const SETTINGS = {
  data: ['data', 'data file', 'json'],
  api: ['products api', 'api'],
  note: ['note', 'price note', 'disclaimer'],
  taxNote: ['tax note'],
  filters: ['filters and compare', 'filters', 'show filters'],
  comparePage: ['compare page'],
  compareLimit: ['compare limit'],
  compareLabel: ['compare label', 'compare button', 'compare products label'],
  compareTitle: ['compare title', 'compare panel title'],
  compareData: ['compare data', 'compare products data'],
};
const LINK_SETTINGS = ['data', 'api', 'comparePage', 'compareData'];
const PROMO_COLUMNS = {
  range: ['promo range', 'range'],
  desktopImage: ['desktop image', 'promo desktop image'],
  mobileImage: ['mobile image', 'promo mobile image'],
  alt: ['image alt', 'alt'],
  link: ['link', 'promo link'],
  desktopPosition: ['desktop position', 'promo desktop position'],
  mobilePosition: ['mobile position', 'promo mobile position'],
};
const PRODUCT_COLUMNS = {
  code: ['code', 'sku', 'product code'],
  name: ['name', 'product name'],
  brand: ['brand', 'range'],
  category: ['category'],
  image: ['image', 'pack shot', 'packshot'],
  url: ['url', 'link', 'page url'],
  badge: ['badge', 'tag'],
  features: ['features'],
  price: ['price', 'mrp'],
  popularity: ['popularity', 'order'],
  filters: ['filters'],
};
const columnOf = (columns, label) => Object.keys(columns)
  .find((field) => columns[field].some((name) => key(name) === key(label)));

/** settings, ranges, promos and products authored in the block table */
function readTable(block) {
  const table = {
    settings: {}, ranges: [], promos: [], products: [], filterOrder: [], compareLogos: [],
  };
  let mode = 'settings';
  let columns = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const labels = cells.map(cellText);
    const first = key(labels[0]);
    // heading rows
    if (first === 'setting' || first === 'settings') { mode = 'settings'; return; }
    if (first === 'range' && key(labels[1]) === 'heading') { mode = 'ranges'; return; }
    if (first === 'filtergroup') { mode = 'filters'; return; }
    if (first === 'comparerange') { mode = 'compareLogos'; return; }
    if (first === 'promorange') {
      mode = 'promos';
      columns = labels.map((label) => columnOf(PROMO_COLUMNS, label));
      return;
    }
    const productFields = labels.map((label) => columnOf(PRODUCT_COLUMNS, label));
    if (productFields.includes('name') && productFields.includes('url')) {
      mode = 'products';
      columns = productFields;
      return;
    }
    const cell = (field) => cells[columns.indexOf(field)];
    if (mode === 'ranges' && labels[0]) {
      table.ranges.push({
        range: labels[0],
        heading: labels[1] || '',
        headingCell: cells[1],
        logo: cellImage(cells[2]),
        // | Note |: the note under this range (else the table's Note row, if any)
        note: labels[3] || '',
        row,
      });
    } else if (mode === 'compareLogos' && labels[0]) {
      // | Compare range | Logo |: the compare panel's logo of a range the page doesn't list
      const logo = cellImage(cells[1]);
      if (logo) table.compareLogos.push({ range: labels[0], logo });
    } else if (mode === 'filters' && labels[0]) {
      // | Filter group | Options order |: the groups shown, in order, and their options' order
      table.filterOrder.push({
        name: labels[0],
        values: (labels[1] || '').split(',').map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      });
    } else if (mode === 'promos' && labels[0]) {
      // an empty position is null: the range's own (data) position, else after the cards
      const place = (c) => (cellText(c)
        ? Math.max(0, Number.parseInt(cellText(c), 10) || 0) : null);
      const desktop = cellImage(cell('desktopImage')) || cellImage(cell('mobileImage'));
      const mobile = cellImage(cell('mobileImage'));
      if (!desktop) return;
      table.promos.push({
        range: labels[0],
        desktop,
        mobile,
        alt: cellText(cell('alt')) || desktop.alt || mobile?.alt,
        url: cellLink(cell('link')),
        desktopPosition: place(cell('desktopPosition')),
        mobilePosition: place(cell('mobilePosition')),
        row,
      });
    } else if (mode === 'products') {
      const record = Object.fromEntries(Object.keys(PRODUCT_COLUMNS)
        .map((field) => [field, field === 'image' ? cellImage(cell(field))?.src : cellText(cell(field))]));
      record.url = cellLink(cell('url'));
      const features = cell('features')?.querySelectorAll('li');
      if (features?.length) record.features = [...features].map((li) => li.textContent);
      const product = normalizeProduct(record);
      product.row = row;
      if (product.name && product.url) table.products.push(product);
    } else if (mode === 'settings') {
      const field = columnOf(SETTINGS, labels[0]);
      if (field && labels[1]) {
        table.settings[field] = LINK_SETTINGS.includes(field) ? cellLink(cells[1]) : labels[1];
      }
    }
  });
  return table;
}

/* ---------- cards ---------- */

// Wishlist heart; clicks and saved state are handled by scripts/wishlist.js (initWishlist)
function wishlistButton(product) {
  return wishlistHeart({
    code: product.code,
    name: product.name,
    price: product.price,
    className: 'products-listing-wishlist',
  });
}

// "Compare" checkbox; the filter bar (compare-products-panel.js) keeps the selection (up to 3) and the
// Compare Now link
function compareCheckbox(product) {
  const label = el('label', 'products-listing-compare');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.dataset.compareCode = product.code;
  input.setAttribute('aria-label', `Compare ${product.name}`);
  label.append(input, el('span', 'products-listing-checkmark'), el('span', '', 'Compare'));
  label.lastElementChild.setAttribute('aria-hidden', 'true');
  return label;
}

// a product's card
function productCard(product, taxNote) {
  const card = el('li', 'products-listing-card');
  card.dataset.productCode = product.code;
  card.dataset.productName = product.name;
  card.dataset.filters = JSON.stringify(product.filters);
  if (product.row) moveInstrumentation(product.row, card);
  if (product.badge) card.append(el('p', 'products-listing-badge', product.badge));
  if (product.code) card.append(wishlistButton(product));

  if (product.image) {
    const image = el('div', 'products-listing-image');
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = product.image;
    img.alt = product.imageAlt || product.name;
    img.loading = 'lazy';
    img.width = 221;
    img.height = 264;
    picture.append(img);
    image.append(picture);
    card.append(image);
  }

  const title = el('h3', 'products-listing-title');
  const link = el('a', '', product.name);
  link.href = siteUrl(product.url);
  link.addEventListener('click', () => {
    pushAdobeProductTitleClick({
      productName: product.name,
      destinationUrl: link.href,
      productSku: product.code,
      event: 'product_tile_click',
    });
  });
  title.append(link);
  card.append(title);

  if (product.features.length) {
    const features = el('ul', 'products-listing-features');
    product.features.forEach((feature) => features.append(el('li', '', feature)));
    card.append(features);
  }

  if (product.price) {
    const price = el('div', 'products-listing-price');
    const mrp = el('p', '', 'MRP ₹ ');
    mrp.append(el('strong', '', product.price));
    const tax = el('p', '', taxNote);
    markFootnotes(tax);
    price.append(mrp, tax);
    card.append(price);
  }
  if (product.code && document.querySelector('.product-filters')) card.append(compareCheckbox(product));
  return card;
}

/* ---------- promos ---------- */

/** a promo tile for one view: the image (sized for the tile), linked when there is a link */
function promoTile(promo, view) {
  const image = view === 'desktop' ? promo.desktop : promo.mobile;
  if (!image) return null;
  let url;
  try {
    url = new URL(image.src, window.location.href);
  } catch (e) {
    return null;
  }
  let picture;
  if (url.origin === window.location.origin || /\.aem\.(page|live)$/.test(url.hostname)) {
    picture = createOptimizedPicture(url.pathname, promo.alt, false, view === 'desktop'
      ? [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }]
      : [{ width: '750' }]);
  } else {
    picture = el('picture');
    const img = el('img');
    img.src = url.href;
    img.alt = promo.alt;
    img.loading = 'lazy';
    picture.append(img);
  }
  const content = promo.url && !/^javascript:/i.test(promo.url)
    ? el('a', 'products-listing-promo-link')
    : el('div', 'products-listing-promo-link');
  if (content.tagName === 'A') content.href = siteUrl(promo.url, new URL(promo.url, window.location.href).href);
  content.append(picture);
  const item = el('li', `products-listing-promo products-listing-promo-${view}`);
  item.append(content);
  if (view === 'desktop' && promo.row) moveInstrumentation(promo.row, item);
  return item;
}

/**
 * Puts a range's promos in its list: each tile at its place (before that card); the desktop tile
 * covers the rest of its row, the mobile tile is one card wide; past the cards, after them.
 */
function placePromos(list, promos, cards) {
  promos.forEach((promo) => {
    [['desktop', promo.desktopPosition, DESKTOP_COLUMNS], ['mobile', promo.mobilePosition, MOBILE_COLUMNS]]
      .forEach(([view, position, columns]) => {
        const tile = promoTile(promo, view);
        if (!tile) return;
        let place = position;
        let start = 0;
        if (!place || place > cards.length) {
          // the row after the last card keeps the place's column (desktop); further on, the end
          const row = (p) => Math.ceil(p / columns);
          if (place && view === 'desktop' && row(place) === row(cards.length + 1)) {
            start = ((place - 1) % columns) + 1;
          }
          place = 0;
        }
        let span = columns - (cards.length % columns);
        if (place) span = view === 'desktop' ? columns - ((place - 1) % columns) : 1;
        if (start) span = columns - start + 1;
        if (view === 'mobile') span = Math.min(span, 1);
        tile.style.setProperty('--products-listing-promo-span', String(span));
        if (start) tile.style.setProperty('--products-listing-promo-start', String(start));
        // a tile alone in its row takes its image's height (no card beside it to give one)
        const alone = span === columns || (!place && cards.length % columns === 0);
        tile.classList.toggle('is-full-row', alone);
        list.insertBefore(tile, (place && cards[place - 1]) || null);
      });
  });
}

/* ---------- ranges ---------- */

/**
 * The ranges of the data: its `brands` list (the source's / AEM's data-attr-brands: brandName,
 * brandTitleBlack, brandTitleGradient, numField = the promo's place) or `ranges` sheet
 */
function dataRanges(json) {
  return [...sheetRows(json, 'brands'), ...sheetRows(json, 'ranges')].map((row) => {
    const range = String(row.brandName ?? row.range ?? row.brand ?? '').trim();
    const accent = String(row.brandTitleGradient ?? '').trim();
    const heading = row.brandTitleBlack
      ? `${String(row.brandTitleBlack).trim()} ${accent}`.trim()
      : String(row.heading ?? row.title ?? '').trim();
    return {
      range,
      heading,
      accent,
      promoPosition: Number.parseInt(row.numField ?? row.promoPosition, 10) || null,
      logo: row.logo ? { src: row.logo, alt: row.logoAlt || range } : null,
      note: String(row.note ?? '').trim(),
    };
  }).filter((group) => group.range);
}

/**
 * The block's range groups: the Range rows in order, and only those (a range page lists its own
 * range even when the data has all the products); without Range rows, the data's ranges in order,
 * then the products' other ranges in order of appearance. `others` adds the unlisted ranges also
 * with Range rows (the compare panel: all products).
 */
function rangeGroups(table, json, products, { others = !table.ranges.length } = {}) {
  const fromData = dataRanges(json);
  const same = (a, b) => toClassName(a) === toClassName(b);
  const listed = table.ranges.length
    ? table.ranges.map((group) => ({
      ...group,
      promoPosition: fromData.find((data) => same(data.range, group.range))?.promoPosition || null,
    }))
    : fromData;
  const groups = listed.map((group) => ({ ...group, products: [] }));
  const find = (brand) => groups.find((group) => toClassName(group.range) === toClassName(brand));
  products.forEach((product) => {
    let group = find(product.brand || 'Products');
    if (!group && !others) return;
    if (!group) {
      const range = product.brand || 'Products';
      group = {
        range, heading: `${range} Interior Wall Paints`, logo: null, products: [],
      };
      groups.push(group);
    }
    group.products.push(product);
  });
  groups.forEach((group) => group.products.sort((a, b) => a.popularity - b.popularity));
  return groups.filter((group) => group.products.length);
}

/** a range's section after the block's own, with its classes (styles) */
function rangeSection(template) {
  const section = document.createElement('div');
  section.className = template.className;
  section.dataset.sectionStatus = 'loaded';
  return section;
}

/**
 * A range's heading: as authored (its emphasis is the gradient part), else with
 * "Interior Wall Paints" as the emphasis, as the authored headings
 */
function headingWrapper(group) {
  const wrapper = el('div', 'default-content-wrapper');
  const h2 = el('h2');
  h2.id = toClassName(group.heading);
  const authored = group.headingCell;
  if (authored?.querySelector('em')) {
    h2.append(...(authored.querySelector('p, h2, h3') || authored).childNodes);
  } else if (group.accent && group.heading.endsWith(group.accent)) {
    // from the data: brandTitleBlack, then brandTitleGradient as the emphasis
    h2.append(group.heading.slice(0, -group.accent.length), el('em', '', group.accent));
  } else {
    const [, text, accent] = group.heading.match(/^(.*?)(interior wall paints)?$/i);
    h2.append(text);
    if (accent) h2.append(el('em', '', accent));
  }
  wrapper.append(h2);
  return wrapper;
}

function noteWrapper(text) {
  const wrapper = el('div', 'default-content-wrapper');
  const p = el('p', '', text);
  markFootnotes(p);
  wrapper.append(p);
  return wrapper;
}

/* ---------- filters and compare (the bar of ./compare-products-panel.js) ---------- */

const yes = (value) => /^(yes|true|on|show|1)$/i.test(String(value || '').trim());

/**
 * The filter and compare bar's element, in a section of its own before the listing's (the
 * section and wrapper classes its styles, ./compare-products-panel.css, are written for)
 */
function filtersSection(section) {
  const container = el('div', 'full-width section product-filters-container');
  container.dataset.sectionStatus = 'loaded';
  const wrapper = el('div', 'product-filters-wrapper');
  const filters = el('div', 'product-filters');
  wrapper.append(filters);
  container.append(wrapper);
  section.before(container);
  return filters;
}

// a range logo as the bar uses it
const logoOf = (logo, range) => (logo?.src ? {
  src: logo.src,
  alt: logo.alt || range,
  width: Number(logo.width) || undefined,
  height: Number(logo.height) || undefined,
} : undefined);

/**
 * The compare panel's products: all the products, also on a page listing one range. They come
 * from the same answer as the listing's, so no second request: the Compare data if authored,
 * else the Products API when it answers with products (the listing's own request), else the
 * all-products file /eds/products.json (on a page whose Data is that file, its own request).
 * By range, in the same order on every page as on the source: the data's `ranges` sheet or
 * `brands` order, else the Compare range rows', else the Range rows', then the other ranges as
 * they appear; logos from the page's Range rows, else its Compare range rows, else the data
 * (logo, logoAlt). Null when there are no products (the panel then lists the page's cards).
 */
async function compareProducts(settings, table) {
  const api = settings.compareData || !settings.api ? null : await loadJson(settings.api);
  const json = productsOf(api).length ? api : await loadJson(settings.compareData || DATA);
  const products = productsOf(json).filter((product) => product.code);
  if (!products.length) return null;
  const same = (a, b) => toClassName(a) === toClassName(b);
  const logoFor = (group) => table.ranges.find((row) => same(row.range, group.range))?.logo
    || table.compareLogos.find((row) => same(row.range, group.range))?.logo
    || group.logo;
  // the data's range order, else the Compare range rows', else the Range rows'
  let order = table;
  if (dataRanges(json).length) order = { ranges: [] };
  else if (table.compareLogos.length) order = { ranges: table.compareLogos };
  return rangeGroups(order, json, products, { others: true }).map((group) => ({
    range: group.range,
    logo: logoOf(logoFor(group), group.range),
    products: group.products.map(({
      code, name, url, image,
    }) => ({
      code, name, url, image,
    })),
  }));
}

/**
 * The filter and compare bar's config, from the listing's own data: the filter groups and values
 * of all its products (the Filter group rows pick the groups and order them and their options:
 * values no row lists come after the listed ones), the compare page and limit, the compare
 * panel's products (all products, see compareProducts) and the page's ranges (selector, logo),
 * the panel's fallback
 */
function filtersConfig(settings, groups, table) {
  const { filterOrder } = table;
  const products = groups.flatMap((group) => group.products);
  let filters = filterGroupsFromProducts(products);
  if (filterOrder.length) {
    filters = filterOrder.map(({ name, values }) => {
      const group = filters.find((data) => key(data.key) === key(name));
      if (!group) return null;
      const listed = values.filter((value) => group.values.includes(value));
      return {
        key: group.key,
        values: [...listed, ...group.values.filter((value) => !listed.includes(value))],
      };
    }).filter(Boolean);
  }
  return {
    filters: filters.map((group) => ({ name: group.key, options: group.values })),
    compare: {
      page: settings.comparePage || undefined,
      limit: Number.parseInt(settings.compareLimit, 10) || 3,
      label: settings.compareLabel || undefined,
      title: settings.compareTitle || undefined,
    },
    compareProducts: () => compareProducts(settings, table),
    sections: groups.map((group) => ({
      selector: `.products-listing.${toClassName(group.range)}`,
      range: group.range,
      logo: logoOf(group.logo, group.range),
    })),
  };
}

// the source's slideDown / slideUp of a filter group (jQuery: 500ms, "swing")
const SLIDE = { duration: 500, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' };

/**
 * Filter groups slide open and closed as on the source: compare-products-panel.js shows and hides a
 * group's options with `hidden`; each change animates the list's height (kept shown while it
 * closes)
 */
function animateFilterGroups(filters) {
  const panel = filters.querySelector('.product-filters-panel');
  if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const slide = ({ target: list, oldValue }) => {
    const opening = !list.hidden;
    // no change, or the panel is closed (its groups reset without a slide)
    if (opening === (oldValue === null) || panel.hidden) return;
    list.getAnimations().forEach((animation) => animation.cancel());
    list.style.overflow = 'hidden';
    // shown while it closes (important: the site's later styles hide [hidden] with !important)
    if (!opening) list.style.setProperty('display', 'block', 'important');
    const frames = [{ height: '0px' }, { height: `${list.scrollHeight}px` }];
    const done = () => {
      if (list.getAnimations().length) return;
      list.style.removeProperty('display');
      list.style.removeProperty('overflow');
    };
    list.animate(opening ? frames : frames.reverse(), SLIDE).finished.then(done, done);
  };
  new MutationObserver((records) => {
    // the panel opening or closing: its groups start closed at once, as on the source
    if (records.some((record) => record.target === panel)) return;
    records.filter((record) => record.target.classList.contains('product-filters-options'))
      .forEach(slide);
  })
    .observe(panel, {
      subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true,
    });
}

/**
 * Shows the sections added next to the block's own at the moment its own section is shown (the
 * section loader keeps it display:none until decorate() is done), so the added ones do not paint
 * first and get pushed down (layout shift) when the block's section appears above them.
 */
function revealWith(section, added) {
  const show = () => added.forEach((node) => { node.style.display = ''; });
  if (section.style.display !== 'none') {
    show();
    return;
  }
  const observer = new MutationObserver(() => {
    if (section.style.display === 'none') return;
    observer.disconnect();
    show();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['style'] });
  // safety net in case the section is never revealed
  window.setTimeout(() => { observer.disconnect(); show(); }, 5000);
}

export default async function decorate(block) {
  const table = readTable(block);
  const settings = { data: DATA, ...table.settings };
  const taxNote = settings.taxNote || TAX_NOTE;
  block.replaceChildren();

  // products: the AEM API first, else the block table, else the data file (one request each)
  const api = settings.api ? await loadJson(settings.api) : null;
  let products = productsOf(api);
  let json = null;
  if (!products.length) products = table.products;
  // the data file also when the ranges are neither authored nor in the API's answer
  if (!products.length || (!table.ranges.length && !dataRanges(api).length)) {
    json = await loadJson(settings.data);
    if (!products.length) products = productsOf(json);
  }
  if (!products.length) return;

  const groups = rangeGroups(table, dataRanges(api).length ? api : json, products);
  const section = block.closest('.section');
  // the filter bar is on the page before the cards render, so they get their Compare checkbox
  const filters = yes(settings.filters) ? filtersSection(section) : null;
  const added = [];
  if (filters) {
    const filtersContainer = filters.closest('.section');
    filtersContainer.style.display = 'none';
    added.push(filtersContainer);
  }
  const wrapper = block.parentElement;
  const blocks = [];
  let after = section;
  groups.forEach((group, i) => {
    // the range's own note (its Range row's Note column), else the table's Note row
    const note = group.note || settings.note;
    // the first range in the block's own section, the others in sections after it
    let target = block;
    if (i === 0) {
      if (group.heading) wrapper.before(headingWrapper(group));
      if (note) wrapper.after(noteWrapper(note));
    } else {
      const next = rangeSection(section);
      const blockWrapper = el('div', 'products-listing-wrapper');
      target = el('div', 'products-listing block');
      target.dataset.blockName = 'products-listing';
      target.dataset.blockStatus = 'loaded';
      blockWrapper.append(target);
      if (group.heading) next.append(headingWrapper(group));
      next.append(blockWrapper);
      if (note) next.append(noteWrapper(note));
      next.style.display = 'none';
      added.push(next);
      after.after(next);
      after = next;
    }
    target.classList.add(toClassName(group.range));
    target.dataset.range = group.range;
    if (group.row) moveInstrumentation(group.row, target);
    const list = el('ul', 'products-listing-list');
    const cards = group.products.map((product) => productCard(product, taxNote));
    list.append(...cards);
    // a promo's empty position: the range's place in the data (numField), else after the cards
    const promos = table.promos
      .filter((promo) => toClassName(promo.range) === toClassName(group.range))
      .map((promo) => {
        const desktopPosition = promo.desktopPosition ?? group.promoPosition ?? 0;
        return {
          ...promo,
          desktopPosition,
          mobilePosition: promo.mobilePosition ?? desktopPosition,
        };
      });
    placePromos(list, promos, cards);
    target.append(list);
    blocks.push(target);
  });

  blocks.forEach((target) => initWishlist(target));
  if (filters) {
    const [{ default: decorateFilters }] = await Promise.all([
      import('./compare-products-panel.js'),
      loadCSS(`${window.hlx.codeBasePath}/blocks/products-listing/compare-products-panel.css`),
    ]);
    decorateFilters(filters, filtersConfig(settings, groups, table));
    animateFilterGroups(filters);
  }
  revealWith(section, added);
  document.dispatchEvent(new CustomEvent('product-cards:loaded', { detail: { block, blocks } }));
}
