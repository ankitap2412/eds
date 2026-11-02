/*
 * Catalogue Listing: shade details panel (source: the shadelisting component's quick view,
 * #js-shade-palette-append / .PD-quickview-wrap). A grid card opens it instead of going to the
 * shade page: the shade's palette (8 related shades), a room photo of the selected shade, its
 * name and code, the wishlist heart and the CTAs:
 *   BUY NOW (two from 900px, one below) → the selected shade's page;
 *   SPEAK TO PROFESSIONAL (from 900px) → scrolls to the page's lead form (as the help card and
 *     the side card, and as the source);
 *   VIEW IN AP COLOUR APP (below 900px) → the AP Colour app, or its store page;
 *   the down arrow on the photo (below 900px) → the shade's colour in place of the photo.
 * The CTA labels and app links are fixed here, not authored (the user's choice).
 *
 * Layout: from 900px a full-width grid item after the clicked card's row; below 900px a sheet
 * fixed under the header while the page behind it doesn't scroll (as the source below 992px).
 *
 * Data: the "Quick view closest shade API" row (shadelistingpalette.json), requested by
 * catalogue-listing.js with the clicked shade's pageNumber. The panel opens at once with the
 * clicked shade (its listing data: name, code, colour, page); the API's shades (8, in its order,
 * with room photos and descriptions) replace it when they arrive, the clicked one selected. When
 * there is no row or the request fails, the panel keeps the clicked shade alone. The shade's
 * colour fills the photo's place until (or when there is no) room photo.
 *
 * Loaded by catalogue-listing.js on the first card click.
 */
import { BETA_DOMAIN, PROD_DOMAIN, isProdDomain } from '../../scripts/environment.js';

const MOBILE_MEDIA = window.matchMedia('(max-width: 899px)');
const SHEET_OPEN = 'catalogue-listing-sheet-open';
const ASSET_ORIGIN = `https://${isProdDomain() ? PROD_DOMAIN : BETA_DOMAIN}`;
// the room photo as a DAM rendition: same proportions, ~75 KB instead of ~250 KB
const ROOM_SHOT_RENDITION = '.transform/cc-width-720-height-540/image.jpeg';

// the source's labels
const LABELS = {
  codePrefix: 'COLOUR CODE -',
  buyNow: 'BUY NOW',
  speak: 'SPEAK TO PROFESSIONAL',
  app: 'VIEW IN AP COLOUR APP',
};

// the AP Colour app, as linked from the source's quick view (.colour-app-link)
const COLOUR_APP = {
  android: 'intent://asianpaints.com/#Intent;scheme=https;package=com.asianpaints.dbu.digital.colourwithasianpaints;end',
  playStore: 'https://play.google.com/store/apps/details?id=com.asianpaints.dbu.digital.colourwithasianpaints&hl=en',
  ios: 'colourwithasianpaints://',
  appStore: 'https://apps.apple.com/in/app/colour-with-asian-paints/id1277723039',
};

let panelCount = 0;

/**
 * Opens the AP Colour app (the source's getAPMobileApp): Android → the app (Chrome offers the Play
 * Store when it isn't installed); iPhone/iPad → the app, then the App Store if the page is still
 * showing; other devices follow the link (the Play Store page).
 */
function openColourApp(event) {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (/android/i.test(ua)) {
    event.preventDefault();
    window.location.href = COLOUR_APP.android;
  } else if (ios) {
    event.preventDefault();
    const timer = setTimeout(() => {
      if (!document.hidden) window.location.href = COLOUR_APP.appStore;
    }, 1500);
    document.addEventListener('visibilitychange', () => clearTimeout(timer), { once: true });
    window.location.href = COLOUR_APP.ios;
  }
}

/** The room photo's URL (the API gives DAM paths; its mobile and desktop shots are the same). */
function roomShot(shade) {
  const shots = shade.naturalDesktopRoomShots || shade.naturalMobileRoomShots;
  const path = Array.isArray(shots) ? shots[0] : shots;
  return path ? new URL(path, ASSET_ORIGIN).href : '';
}

/**
 * Where the site header ends on screen now: on phones it shrinks once the page has scrolled (its
 * brand bars slide up), so --header-height alone would leave a gap above the sheet.
 */
function headerBottom() {
  const header = document.querySelector('header');
  if (!header) return 0;
  const bars = [...header.querySelectorAll(':scope > * > *')]
    .filter((bar) => ['fixed', 'sticky'].includes(getComputedStyle(bar).position));
  const bottoms = (bars.length ? bars : [header]).map((bar) => bar.getBoundingClientRect().bottom);
  return Math.max(0, ...bottoms);
}

/** The last grid item in the same row as `item` (rows are found by their top offset). */
function rowEnd(item) {
  let last = item;
  for (let next = item.nextElementSibling; next && next.offsetTop === item.offsetTop;
    next = next.nextElementSibling) {
    last = next;
  }
  return last;
}

/**
 * @param {object} options
 * @param {{ heart: Function, refresh: Function }|null} options.wishlist
 * @param {string} options.wishlistType
 * @param {object} options.helpers el, rememberShade, cta (content, className, minLines, popup),
 *   titleCase (from catalogue-listing.js)
 * @returns {{ toggle: (shade: object, link: Element, palette?: Promise<object[]|null>) => void,
 *   close: (restoreFocus?: boolean) => void }}
 */
export default function createQuickView({ wishlist, wishlistType, helpers }) {
  const {
    el, rememberShade, cta, titleCase,
  } = helpers;
  let state = null; // the open panel: { link, refs, palette, index }

  // below 900px: the sheet starts below the header and the page behind it doesn't scroll
  const placeSheet = () => {
    if (state && MOBILE_MEDIA.matches) {
      state.refs.section.style.setProperty('--cl-sheet-top', `${headerBottom()}px`);
    }
  };
  const lockScroll = () => {
    placeSheet();
    document.documentElement.classList.toggle(SHEET_OPEN, Boolean(state) && MOBILE_MEDIA.matches);
  };
  MOBILE_MEDIA.addEventListener('change', lockScroll);
  // the header shrinks after a scroll with a short transition (a tap can come first): follow it
  document.querySelector('header')?.addEventListener('transitionend', placeSheet);

  function close(restoreFocus = true) {
    if (!state) return;
    const { link, refs } = state;
    state = null;
    refs.item.remove();
    link.setAttribute('aria-expanded', 'false');
    link.removeAttribute('aria-controls');
    lockScroll();
    if (restoreFocus && link.isConnected) link.focus();
  }

  function select(index, remember) {
    const { palette, refs } = state;
    const shade = palette[index];
    const name = shade.entityName || '';
    const code = `${shade.entityCode || ''}`;
    state.index = index;
    refs.palette.querySelectorAll('button').forEach((swatch, i) => {
      swatch.setAttribute('aria-pressed', `${i === index}`);
    });
    refs.name.textContent = name;
    refs.code.textContent = `${LABELS.codePrefix}${code}`;
    refs.desc.textContent = shade.entityDescription || '';
    refs.desc.hidden = !shade.entityDescription;
    // the API's pageUrl as returned
    const href = shade.pageUrl || '';
    [refs.buy, refs.buyLink].forEach((a) => {
      if (href) a.href = href;
      else a.removeAttribute('href');
    });
    refs.media.style.backgroundColor = shade.shadeHexCode || '';
    const shot = roomShot(shade);
    refs.image.hidden = !shot;
    if (shot) {
      refs.image.alt = titleCase(name);
      refs.image.dataset.original = shot;
      refs.image.src = `${shot}${ROOM_SHOT_RENDITION}`;
    } else {
      refs.image.removeAttribute('src');
    }
    if (refs.heart) {
      refs.heart.hidden = !code;
      refs.heart.dataset.attrSku = code;
      refs.heart.dataset.pid = code;
      refs.heart.dataset.attrTitle = name;
      refs.heart.setAttribute('aria-label', `Wishlist: ${name || code}`);
      wishlist.refresh();
    }
    if (remember) rememberShade(code);
  }

  function renderPalette() {
    const { palette, refs } = state;
    refs.palette.replaceChildren(...palette.map((shade, i) => el('button', {
      type: 'button',
      className: 'catalogue-listing-quickview-swatch',
      style: `background-color: ${shade.shadeHexCode || '#eee'}`,
      'aria-label': `${titleCase(shade.entityName || '')} ${shade.entityCode || ''}`.trim(),
      'aria-pressed': 'false',
      'data-index': `${i}`,
    })));
    refs.next.hidden = palette.length < 2;
  }

  /** The API's shades in place of the clicked one (which stays selected; it leads if missing). */
  function fillPalette(shades, shade) {
    const code = `${shade.entityCode || ''}`;
    const index = shades.findIndex((item) => `${item.entityCode || ''}` === code);
    const hadFocus = state.refs.palette.contains(document.activeElement);
    state.palette = index < 0 ? [shade, ...shades] : shades;
    renderPalette();
    select(Math.max(index, 0), false);
    if (hadFocus) state.refs.palette.querySelector('[aria-pressed="true"]')?.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    // the sheet covers the page: Tab stays in it
    if (event.key !== 'Tab' || !MOBILE_MEDIA.matches) return;
    const focusable = [...state.refs.section.querySelectorAll('a[href], button')]
      .filter((node) => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === state.refs.section)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function build() {
    panelCount += 1;
    const id = `catalogue-listing-quickview-${panelCount}`;
    const image = el('img', { className: 'catalogue-listing-quickview-image', alt: '', decoding: 'async' });
    // the rendition can be missing: fall back to the original photo, then to the colour
    image.addEventListener('error', () => {
      const { original } = image.dataset;
      if (original && image.src !== original) image.src = original;
      else image.hidden = true;
    });
    const heart = wishlist ? wishlist.heart({
      code: '', type: wishlistType, className: 'catalogue-listing-quickview-wishlist',
    }) : null;
    const closeButton = el('button', { type: 'button', className: 'catalogue-listing-quickview-close', 'aria-label': 'Close' });
    const next = el('button', { type: 'button', className: 'catalogue-listing-quickview-next', 'aria-label': 'Next colour' });
    const expand = el('button', {
      type: 'button', className: 'catalogue-listing-quickview-expand', 'aria-label': 'Full colour view', 'aria-pressed': 'false',
    });
    const media = el('div', { className: 'catalogue-listing-quickview-media' }, image, heart, closeButton, next, expand);
    const palette = el('div', { className: 'catalogue-listing-quickview-palette' });
    const name = el('h3', { className: 'catalogue-listing-quickview-name', id: `${id}-name` });
    const code = el('p', { className: 'catalogue-listing-quickview-code' });
    const desc = el('p', { className: 'catalogue-listing-quickview-desc' });
    const buy = el('a', { className: 'catalogue-listing-quickview-buy' }, LABELS.buyNow);
    const buyLink = el('a', { className: 'catalogue-listing-quickview-buy-link' }, LABELS.buyNow);
    const app = el(
      'a',
      { className: 'catalogue-listing-quickview-app', href: COLOUR_APP.playStore },
      el('span', {}, LABELS.app),
    );
    app.addEventListener('click', openColourApp);
    // scrolls to the page's lead form (cta() of catalogue-listing.js, as the help card)
    const speak = cta({ images: [], links: [], texts: [LABELS.speak] }, 'catalogue-listing-quickview-speak', 1);
    const section = el(
      'section',
      {
        className: 'catalogue-listing-quickview', id, 'aria-labelledby': name.id, tabindex: '-1',
      },
      media,
      palette,
      el('div', { className: 'catalogue-listing-quickview-info' }, name, code, buy, desc, app),
      el('div', { className: 'catalogue-listing-quickview-actions' }, buyLink, speak),
    );
    const item = el('li', { className: 'catalogue-listing-wide catalogue-listing-quickview-item' }, section);

    // phones: the shade's colour fills the photo's place (and more), the arrow turns up
    expand.addEventListener('click', () => {
      const on = !section.classList.contains('is-extended');
      section.classList.toggle('is-extended', on);
      expand.setAttribute('aria-pressed', `${on}`);
    });
    closeButton.addEventListener('click', () => close());
    next.addEventListener('click', () => select((state.index + 1) % state.palette.length, true));
    palette.addEventListener('click', (event) => {
      const swatch = event.target.closest('button');
      if (swatch) select(Number(swatch.dataset.index), true);
    });
    section.addEventListener('keydown', onKeydown);
    return {
      item, section, media, image, heart, next, palette, name, code, desc, buy, buyLink,
    };
  }

  /**
   * Opens the panel for a grid card's shade; its card again closes it. `palette` resolves to the
   * quick view API's shades for the shade's pageNumber (or null).
   */
  function toggle(shade, link, palette) {
    if (state?.link === link) {
      close();
      return;
    }
    close(false);
    const refs = build();
    rowEnd(link.closest('li')).after(refs.item);
    state = {
      link, refs, palette: [shade], index: 0,
    };
    renderPalette();
    select(0, false);
    const opened = state;
    palette?.then((shades) => {
      // still the same panel (not closed or replaced by another card's meanwhile)
      if (shades && state === opened) fillPalette(shades, shade);
    });
    link.setAttribute('aria-expanded', 'true');
    link.setAttribute('aria-controls', refs.section.id);
    lockScroll();
    requestAnimationFrame(() => requestAnimationFrame(placeSheet));
    refs.section.focus({ preventScroll: true });
    if (!MOBILE_MEDIA.matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      refs.section.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  return { toggle, close };
}
