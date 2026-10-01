import { createOptimizedPicture } from '../../scripts/aem.js';

const URL_PATTERN = /^(https?:\/\/|\/)\S*$/;

/**
 * Reads the optional item options cell (e.g. "selected, new tab").
 * @param {Element} [cell] The options cell
 * @returns {{ selected: boolean, newTab: boolean }}
 */
function readOptions(cell) {
  const text = cell?.textContent.toLowerCase() || '';
  return {
    selected: /\bselected\b/.test(text),
    newTab: /new[\s-]?tab|_blank/.test(text),
  };
}

/**
 * Reads the link authored in the link cell, falling back to a linked title.
 * When the link text is a full URL it wins over the href, because publishing
 * rewrites links to the production domain into site-relative paths.
 * @param {Element} [linkCell] The link cell
 * @param {Element} [titleCell] The title cell
 * @returns {string} The href, or empty string when none is authored
 */
function readHref(linkCell, titleCell) {
  const anchor = linkCell?.querySelector('a[href]') || titleCell?.querySelector('a[href]');
  if (anchor) {
    const text = anchor.textContent.trim();
    return /^https?:\/\/\S+$/.test(text) ? text : anchor.getAttribute('href');
  }
  const text = linkCell?.textContent.trim() || '';
  return URL_PATTERN.test(text) ? text : '';
}

/**
 * Sends the brand icon click to Adobe Launch, matching the AEM component.
 * @param {string} title The item title
 */
function trackClick(title) {
  // eslint-disable-next-line no-underscore-dangle
  const satellite = window._satellite;
  if (typeof satellite?.track !== 'function') return;
  satellite.track('brandIcon_click_dcr', {
    cta: title,
    mcvid: window.ccAnalytics?.marketingVisitorId?.(),
  });
}

/**
 * Builds one circle item from an authored row: image | title | link | options.
 * @param {Element} row The authored row
 * @returns {HTMLLIElement|null} The item, or null when the row has no image
 */
function buildItem(row) {
  const img = row.querySelector('picture img');
  if (!img) return null;

  const [, titleCell, linkCell, optionsCell] = row.children;
  const paragraphs = titleCell ? [...titleCell.querySelectorAll('p')] : [];
  const title = (paragraphs[0] || titleCell)?.textContent.trim() || img.alt;
  const descriptions = paragraphs.slice(1).map((p) => p.textContent.trim()).filter(Boolean);
  const href = readHref(linkCell, titleCell);
  const { selected, newTab } = readOptions(optionsCell);

  const li = document.createElement('li');
  li.className = 'circlefilters-item';
  if (selected) li.classList.add('selected');

  const wrapper = document.createElement(href ? 'a' : 'div');
  wrapper.className = 'circlefilters-link';
  if (href) {
    wrapper.href = href;
    if (newTab) {
      wrapper.target = '_blank';
      wrapper.rel = 'noopener';
    }
  }

  // the title names the link, so the image is decorative when a title exists
  const alt = title && title !== img.alt ? '' : img.alt;
  const circle = document.createElement('span');
  circle.className = 'circlefilters-image';
  circle.append(createOptimizedPicture(img.src, alt, false, [{ width: '400' }]));

  const text = document.createElement('span');
  text.className = 'circlefilters-text';
  const titleEl = document.createElement('span');
  titleEl.className = 'circlefilters-title';
  titleEl.textContent = title;
  text.append(titleEl);
  descriptions.forEach((description) => {
    const descEl = document.createElement('span');
    descEl.className = 'circlefilters-description';
    descEl.textContent = description;
    text.append(descEl);
  });

  wrapper.append(circle, text);
  li.append(wrapper);
  return li;
}

/**
 * Builds a text area (intro above or footer below the circles) from a row without an image.
 * @param {Element} row The authored row
 * @param {string} className The area class name
 * @returns {HTMLDivElement} The text area
 */
function buildTextArea(row, className) {
  const area = document.createElement('div');
  area.className = className;
  [...row.children].forEach((cell) => area.append(...cell.childNodes));

  area.querySelectorAll('a').forEach((a) => {
    a.classList.remove('button', 'primary', 'secondary');
    a.classList.add('circlefilters-cta');
    a.closest('.button-wrapper')?.classList.replace('button-wrapper', 'circlefilters-cta-wrapper');
  });
  return area;
}

/**
 * Creates a carousel control button.
 * @param {string} className The button class name
 * @param {string} label The accessible label
 * @returns {HTMLButtonElement} The button
 */
function createButton(className, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * Adds arrows (desktop) and dots (mobile) to the carousel variant.
 * Scrolls one item at a time and wraps around at either end.
 * @param {Element} carousel The carousel wrapper
 * @param {Element} scroller The horizontal scroll container
 * @param {Element} list The item list
 */
function initCarousel(carousel, scroller, list) {
  const items = [...list.children];
  if (items.length < 2) return;

  const step = () => items[1].offsetLeft - items[0].offsetLeft;
  const maxScroll = () => scroller.scrollWidth - scroller.clientWidth;
  const scrollToIndex = (index) => {
    scroller.scrollTo({ left: items[index].offsetLeft - items[0].offsetLeft, behavior: 'smooth' });
  };

  const prev = createButton('circlefilters-prev', 'Previous');
  const next = createButton('circlefilters-next', 'Next');
  prev.addEventListener('click', () => {
    if (scroller.scrollLeft <= 1) scroller.scrollTo({ left: maxScroll(), behavior: 'smooth' });
    else scroller.scrollBy({ left: -step(), behavior: 'smooth' });
  });
  next.addEventListener('click', () => {
    if (scroller.scrollLeft >= maxScroll() - 1) scroller.scrollTo({ left: 0, behavior: 'smooth' });
    else scroller.scrollBy({ left: step(), behavior: 'smooth' });
  });

  const dots = document.createElement('ol');
  dots.className = 'circlefilters-dots';
  const dotButtons = items.map((item, index) => {
    const li = document.createElement('li');
    const dot = createButton('circlefilters-dot', `Show item ${index + 1} of ${items.length}`);
    dot.addEventListener('click', () => scrollToIndex(index));
    li.append(dot);
    dots.append(li);
    return dot;
  });

  const update = () => {
    carousel.classList.toggle('is-scrollable', maxScroll() > 1);
    const atEnd = scroller.scrollLeft >= maxScroll() - 1;
    const active = atEnd ? items.length - 1 : Math.round(scroller.scrollLeft / (step() || 1));
    dotButtons.forEach((dot, index) => {
      if (index === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  let frame;
  scroller.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  new ResizeObserver(update).observe(scroller);

  carousel.append(prev, next, dots);
  update();
}

/**
 * Decorates the circlefilters block.
 * Item rows: image | title | link | options.
 * Rows without an image become text areas above or below the circles.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'circlefilters-list';
  const before = [];
  const after = [];

  [...block.children].forEach((row) => {
    const item = buildItem(row);
    if (item) list.append(item);
    else if (row.textContent.trim()) {
      const hasItems = list.children.length > 0;
      const area = buildTextArea(row, hasItems ? 'circlefilters-footer' : 'circlefilters-intro');
      (hasItems ? after : before).push(area);
    }
  });

  const scroller = document.createElement('div');
  scroller.className = 'circlefilters-scroller';
  scroller.append(list);

  const carousel = document.createElement('div');
  carousel.className = 'circlefilters-carousel';
  carousel.append(scroller);
  block.replaceChildren(...before, carousel, ...after);

  if (block.classList.contains('carousel')) {
    initCarousel(carousel, scroller, list);
    list.querySelectorAll('a.circlefilters-link').forEach((link) => {
      link.addEventListener('click', () => {
        const title = link.querySelector('.circlefilters-title')?.textContent.trim();
        trackClick(title || link.querySelector('img')?.alt || '');
      });
    });
  }
}
