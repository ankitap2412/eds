import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  isTrue, labelOf, readHref, readImage, resolveHref, setTarget,
} from '../../scripts/block-utils.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

// Labels authors write in the first column of a settings row (label | value)...
const SETTING_LABELS = {
  title: ['title', 'section title', 'heading'],
  subtitle: ['sub title', 'subtitle', 'sub-title', 'section sub title'],
};

// ...and in the header row that names the columns of the card rows below it.
const COLUMN_LABELS = {
  icon: ['icon', 'icon image', 'image', 'icon link', 'image link'],
  title: ['title', 'icon title', 'name'],
  description: ['description', 'icon description'],
  link: ['link', 'page link', 'icon url', 'url'],
  border: ['border colour', 'border color', 'colour', 'color'],
  newTab: ['open in new tab', 'new tab'],
};

/**
 * Whether a row is the header row naming the card columns (e.g. Icon | Title | Description).
 * @param {Element} row The authored row
 * @returns {boolean}
 */
function isHeaderRow(row) {
  if (row.querySelector('picture')) return false;
  const cells = [...row.children].filter((cell) => cell.textContent.trim());
  return cells.length >= 2
    && cells.every((cell) => labelOf(cell, COLUMN_LABELS))
    && cells.some((cell) => labelOf(cell, COLUMN_LABELS) === 'icon');
}

/**
 * Sends the card click to Adobe Launch, matching the AEM component.
 * @param {string} text The card title
 * @param {string} link The card link
 * @param {string} parentTitle The section title
 */
function trackClick(text, link, parentTitle) {
  // eslint-disable-next-line no-underscore-dangle
  const satellite = window._satellite;
  if (typeof satellite?.track !== 'function') return;
  satellite.track('cta_link_text', { cta_: text, param1: link, parentTitle });
}

/**
 * Builds the section title from a cell, keeping an authored heading level. Plain text becomes H2.
 * @param {Element} cell The title cell
 * @returns {HTMLHeadingElement} The heading
 */
function buildTitle(cell) {
  const authored = cell.querySelector(HEADINGS);
  const heading = document.createElement(authored ? authored.tagName.toLowerCase() : 'h2');
  heading.className = 'explore-store-cards-title';
  if (authored?.id) heading.id = authored.id;
  heading.textContent = (authored || cell).textContent.trim();
  return heading;
}

/**
 * Builds the icon picture. Uploaded images are optimised; image URLs (e.g. DAM) are used as is.
 * @param {{ src: string, optimize: boolean }} icon The icon
 * @returns {HTMLPictureElement} The picture
 */
function buildIcon(icon) {
  // icons are decorative: the card title says what the card is
  if (icon.optimize) return createOptimizedPicture(icon.src, '', false, [{ width: '96' }]);
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.src = icon.src;
  img.alt = '';
  img.loading = 'lazy';
  img.width = 36;
  img.height = 36;
  picture.append(img);
  return picture;
}

/**
 * Builds one store card.
 * @param {Object} fields The card fields
 * @returns {HTMLLIElement} The card
 */
function buildCard({
  icon, titleCell, descriptionCell, linkCell, borderCell, newTab,
}) {
  const li = document.createElement('li');
  li.className = 'explore-store-cards-card';
  const border = borderCell?.textContent.trim();
  if (border && CSS.supports('color', border)) li.style.borderBottomColor = border;

  const href = readHref(linkCell, titleCell);
  const wrapper = document.createElement(href ? 'a' : 'div');
  wrapper.className = 'explore-store-cards-link';
  if (href) {
    wrapper.href = resolveHref(href);
    setTarget(wrapper, newTab);
  }

  if (icon) {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'explore-store-cards-icon';
    iconWrap.append(buildIcon(icon));
    wrapper.append(iconWrap);
  }

  const title = titleCell?.textContent.trim();
  if (title) {
    const heading = document.createElement('h3');
    heading.className = 'explore-store-cards-card-title';
    heading.textContent = title;
    wrapper.append(heading);
  }

  const description = descriptionCell?.textContent.trim();
  if (description) {
    const p = document.createElement('p');
    p.className = 'explore-store-cards-card-desc';
    p.textContent = description;
    wrapper.append(p);
  }

  li.append(wrapper);
  return li;
}

/**
 * Decorates the explore-store-cards block.
 *
 *   Title | Explore Our Stores
 *   Sub title | Step into an Asian Paints store...
 *   Icon | Title | Description | Link | Border colour   (header row)
 *   <icon> | Colour Idea | Discover... | https://... | #8093B3   (one row per card)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const settings = {};
  const list = document.createElement('ul');
  list.className = 'explore-store-cards-cards';
  let columns;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (isHeaderRow(row)) {
      columns = cells.map((cell) => labelOf(cell, COLUMN_LABELS));
      return;
    }

    const setting = !row.querySelector('picture') && cells.length >= 2
      && labelOf(cells[0], SETTING_LABELS);
    if (setting) {
      [, settings[setting]] = cells;
      return;
    }

    // without a header row, cards are read in the default column order
    const order = columns || ['icon', 'title', 'description', 'link', 'border', 'newTab'];
    const cell = (key) => cells[order.indexOf(key)];
    const icon = readImage(cell('icon'));
    if (!icon && !cell('title')?.textContent.trim()) return;
    list.append(buildCard({
      icon,
      titleCell: cell('title'),
      descriptionCell: cell('description'),
      linkCell: cell('link'),
      borderCell: cell('border'),
      newTab: isTrue(cell('newTab')),
    }));
  });

  const text = document.createElement('div');
  text.className = 'explore-store-cards-text';
  if (settings.title?.textContent.trim()) text.append(buildTitle(settings.title));
  if (settings.subtitle?.textContent.trim()) {
    const sub = document.createElement('p');
    sub.className = 'explore-store-cards-subtitle';
    sub.textContent = settings.subtitle.textContent.trim();
    text.append(sub);
  }

  block.replaceChildren(text, list);

  const sectionTitle = text.querySelector('.explore-store-cards-title')?.textContent.trim() || '';
  // like the AEM component, every card click is tracked, linked or not
  list.querySelectorAll('.explore-store-cards-card').forEach((card) => {
    card.addEventListener('click', () => {
      const cardTitle = card.querySelector('.explore-store-cards-card-title')?.textContent.trim() || '';
      trackClick(cardTitle, card.querySelector('a')?.href || '', sectionTitle);
    });
  });
}
