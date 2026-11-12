/*
 * The wishlist shared by the blocks, as on the source (wishListPage in the wishlist
 * component's clientlib):
 *
 * - a heart is a button with the product's SKU, a wishlist type and a like / dislike action
 *   ([data-attr-sku][data-attr-type][data-attr-action], see wishlistHeart);
 * - signed in, the hearts of the visitor's saved products are selected. Their wishlist comes
 *   from the profile (profile.loggedInUser.json) and is kept in localStorage `userWishlistData`
 *   ({ category: { type: [{ product_SKU, Time_Wishlist }] } });
 * - signed in, a click adds or removes the product and saves the whole wishlist to the profile
 *   (POST profile.wishlist.json, form field `profileData`);
 * - signed out, a click remembers the product (wishListFlag, wishlistSKU, wishListStatus, and
 *   its type in wishlistType) and opens the login; back on the page signed in, the like is
 *   completed: with its heart when the heart is on the page, else (cards still loading, or a
 *   product past LOAD MORE) by adding the product to the wishlist directly. When the profile
 *   refuses an early request (a stale token cookie before the header's sign-in check is done),
 *   both the wishlist and that like are retried on the header's `user-loggedIn`.
 *
 * A block calls initWishlist(root) once its hearts are in root; hearts added later need
 * refresh(). Hearts of every block stay in step. A change is announced as a bubbling
 * `wishlist:change` event on root (detail: { code, type, saved }).
 * Sign-in state and the login come from the header (isUserLoggedIn, startLogin).
 */
import { pushAdobeProductTitleClick, pushAdobeCtaClickEvent } from './analytics_1.js';
import { BETA_DOMAIN, PROD_DOMAIN, isProdDomain } from './environment.js';

const SITE = `https://${isProdDomain() ? PROD_DOMAIN : BETA_DOMAIN}`;
const DATA_KEY = 'userWishlistData';
const PENDING_FLAG = 'wishListFlag';
const PENDING_SKU = 'wishlistSKU';
const PENDING_STATUS = 'wishListStatus';
const PENDING_TYPE = 'wishlistType';
const LOAD_PATH = '/apcolourcatalogue/keycloak/profile.loggedInUser.json';
const SAVE_PATH = '/apcolourcatalogue/keycloak/profile.wishlist.json';
const HEART = '[data-attr-sku][data-attr-type]';

const read = (name) => {
  try {
    return localStorage.getItem(name);
  } catch (e) {
    return null;
  }
};
const write = (name, value) => {
  try {
    if (value === null) localStorage.removeItem(name);
    else localStorage.setItem(name, value);
  } catch (e) {
    // storage unavailable: nothing is kept
  }
};

/** the site's services: relative on its own domains, else on the env's site (prod or beta) */
function service(path, cacheParam) {
  const host = window.location.hostname.toLowerCase();
  const own = host === 'asianpaints.com' || host.endsWith('.asianpaints.com');
  return `${own ? '' : SITE}${path}?${cacheParam}=${Date.now()}`;
}

/** the stored wishlist (it may be JSON in JSON, as the source stores it) */
function readData() {
  let data = read(DATA_KEY);
  try {
    while (typeof data === 'string') data = data ? JSON.parse(data) : null;
  } catch (e) {
    data = null;
  }
  return data && typeof data === 'object' ? data : {};
}

const savedSkus = (type) => new Set((readData().category?.[type] || [])
  .map((entry) => String(entry.product_SKU)));

/** adds or removes the SKU in the stored wishlist; returns the new wishlist */
function update(type, sku, like) {
  const data = readData();
  data.category = data.category || {};
  const list = (data.category[type] || []).filter((entry) => String(entry.product_SKU) !== sku);
  if (like) list.push({ Time_Wishlist: new Date().toISOString(), product_SKU: sku });
  data.category[type] = list;
  write(DATA_KEY, JSON.stringify(data));
  return data;
}

/** the signed-in visitor's wishlist, from the profile */
async function load() {
  try {
    const response = await fetch(service(LOAD_PATH, 'now'), { credentials: 'include' });
    const json = response.ok ? await response.json() : null;
    if (!json?.success) return false;
    write(DATA_KEY, json.userWishListObj ? JSON.stringify(json.userWishListObj) : '');
    return true;
  } catch (e) {
    // the stored wishlist stays
    return false;
  }
}

/** saves the whole wishlist to the profile; false when it wasn't saved (e.g. 401) */
async function save(data) {
  try {
    const response = await fetch(service(SAVE_PATH, '_'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ profileData: JSON.stringify(data) }),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return true;
  } catch (e) {
    write(PENDING_FLAG, 'false');
    return false;
  }
}

/** the header's sign-in state and login; signed out if the header can't be loaded */
async function auth() {
  try {
    const { isUserLoggedIn, startLogin } = await import('../blocks/header/header.js');
    return { signedIn: isUserLoggedIn(), startLogin };
  } catch (e) {
    return { signedIn: false, startLogin: null };
  }
}

/** dd/mm/yyyy and hh:mm:ss, as the source's analytics */
function dateTime() {
  const now = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return {
    date: `${two(now.getDate())}/${two(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`,
  };
}

function isBlogPage() {
  return window.location.pathname.includes('/blogs/');
}

function getBlogTitle() {
  return document.querySelector('.ap-blogs-title')?.textContent.trim() || '';
}

function trackWishlist(event, heart) {
  const productName = heart.dataset.attrTitle || '';
  const productSku = heart.dataset.attrSku;
  const productPrice = heart.dataset.attrPrice || '';
  if (event === 'guestuser_favourite_click') {
    pushAdobeProductTitleClick({ event, productName, productSku });
    return;
  }
  const when = dateTime();
  pushAdobeProductTitleClick(event === 'wishlist_like'
    ? {
      event,
      productName,
      productSku,
      productPrice,
      ...when,
    }
    : {
      event,
      productName,
      productSku,
      productPrice,
      ...when,
    });
}

/**
 * A heart button with the attributes the wishlist reads; the block styles it by className.
 * @param {object} heart
 * @param {string} heart.code the product's SKU
 * @param {string} [heart.type] the wishlist type, as the source's (products, shades, textures...)
 * @param {string} [heart.name] the product's name
 * @param {string} [heart.price] the product's price
 * @param {string} [heart.className] the block's class for the heart
 */
export function wishlistHeart({
  code, type = 'products', name = '', price = '', className = '',
}) {
  const button = document.createElement('button');
  button.type = 'button';
  if (className) button.className = className;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `Wishlist: ${name || code}`);
  button.dataset.attrSku = String(code);
  button.dataset.pid = String(code);
  button.dataset.attrAction = 'like';
  button.dataset.attrType = type;
  if (name) button.dataset.attrTitle = name;
  if (price) button.dataset.attrPrice = price;
  return button;
}

const roots = new Set();
let signedIn = false;
let started = null;

const allHearts = () => [...roots].flatMap((root) => [...root.querySelectorAll(HEART)]);

// as the source's wishlistState: saved products' hearts selected, signed in only
function paint() {
  const saved = new Map();
  allHearts().forEach((heart) => {
    const { attrType: type, attrSku: sku } = heart.dataset;
    if (!saved.has(type)) saved.set(type, signedIn ? savedSkus(type) : new Set());
    const selected = saved.get(type).has(sku);
    heart.setAttribute('aria-pressed', String(selected));
    heart.dataset.attrAction = selected ? 'dislike' : 'like';
  });
}

/** a heart's click; signed in, true when the change was saved */
async function toggle(heart) {
  if (heart.classList.contains('is-busy')) return false;
  heart.classList.add('is-busy');
  const { attrType: type, attrSku: sku } = heart.dataset;
  const { signedIn: now, startLogin } = await auth();
  if (!now) {
    // signed out: remember the product and log in (the source's triggerWishList)
    trackWishlist('guestuser_favourite_click', heart);


    if (isBlogPage()) {
      const blogTitle = getBlogTitle();
      pushAdobeCtaClickEvent({
        event: 'blog_fav_click_guest',
        title: blogTitle,
      })
    }

    write(PENDING_FLAG, 'true');
    write(PENDING_SKU, sku);
    write(PENDING_STATUS, 'true');
    write(PENDING_TYPE, type);
    heart.classList.remove('is-busy');
    if (startLogin) await startLogin(window.location.href);
    return false;
  }
  signedIn = true;
  const like = heart.dataset.attrAction !== 'dislike';
  const data = update(type, sku, like);
  paint();
  trackWishlist(like ? 'wishlist_like' : 'wishlist_product_delete', heart);
   if (isBlogPage()) {
    const blogTitle = getBlogTitle();
    const eventName = like ? 'blog_fav_click' : 'blog_remove';
     pushAdobeCtaClickEvent({
       event: eventName,
       title: blogTitle,
     });
   }
  heart.dispatchEvent(new CustomEvent('wishlist:change', {
    bubbles: true,
    detail: { code: sku, type, saved: like },
  }));
  const ok = await save(data);
  heart.classList.remove('is-busy');
  return ok;
}

/**
 * Completes, once, a like started before the login (signed in, after the saved wishlist has
 * loaded). Its heart may not be on the page yet (a block's cards come with their data) or at
 * all (a shade past LOAD MORE): the remembered product and type are then added to the wishlist
 * directly. A like remembered without its type (by an older version) waits for its heart.
 */
let completing = null;
let loaded = false; // the profile's wishlist has loaded (this visit)
function completePending() {
  // only on top of the profile's wishlist: saving on top of one that didn't load would replace it
  if (!signedIn || !loaded || read(PENDING_FLAG) !== 'true') return Promise.resolve();
  completing = completing || (async () => {
    const sku = read(PENDING_SKU);
    const type = read(PENDING_TYPE);
    const heart = allHearts().find((h) => h.dataset.attrSku === sku
      && (!type || h.dataset.attrType === type));
    if (sku && !heart && !type) return;
    [PENDING_FLAG, PENDING_SKU, PENDING_TYPE].forEach((name) => write(name, null));
    if (!sku) return;
    let ok = true;
    if (heart) {
      if (heart.dataset.attrAction === 'like') ok = await toggle(heart);
    } else if (!savedSkus(type).has(sku)) {
      const data = update(type, sku, true);
      paint();
      document.dispatchEvent(new CustomEvent('wishlist:change', {
        detail: { code: sku, type, saved: true },
      }));
      ok = await save(data);
    }
    // not saved (the profile refused the sign-in): kept for the header's confirmed sign-in
    if (!ok) {
      write(PENDING_FLAG, 'true');
      write(PENDING_SKU, sku);
      if (type) write(PENDING_TYPE, type);
    }
  })().finally(() => { completing = null; });
  return completing;
}

function signIn() {
  started = started || (async () => {
    signedIn = true;
    loaded = await load();
    paint();
    // a like started before the login
    await completePending();
  })();
  return started;
}

/**
 * The header's `user-loggedIn` comes once Keycloak has answered and the token cookie
 * (keycloak_authToken, which the profile services read) is fresh. An earlier sign-in, from the
 * profile stored by a previous visit, may have sent a stale token and been refused (401): then
 * the wishlist is loaded, and a like started before the login completed, again.
 */
async function confirmedSignIn() {
  if (started) {
    await started;
    if (loaded && read(PENDING_FLAG) !== 'true') return;
    started = null;
  }
  await signIn();
}

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  // the header tells when the visitor is signed in; it loads after the first section, so its
  // state is asked for once the page has loaded and is idle: importing the header any earlier
  // (from a block in the LCP section) would compete with the LCP
  document.addEventListener('user-loggedIn', confirmedSignIn);
  const check = () => (window.requestIdleCallback || setTimeout)(async () => {
    if ((await auth()).signedIn) signIn();
  });
  if (document.readyState === 'complete') check();
  else window.addEventListener('load', check, { once: true });
}

/**
 * Sets up the hearts under root ([data-attr-sku][data-attr-type] buttons): their state, and
 * their clicks.
 * @param {Element} root
 * @returns {{ toggle: (heart: Element) => Promise<void>, refresh: () => void }} refresh
 *   paints the hearts added since (and completes a like started before the login whose heart
 *   has just been added)
 */
export default function initWishlist(root) {
  if (!roots.has(root)) {
    roots.add(root);
    root.addEventListener('click', (event) => {
      const heart = event.target.closest(HEART);
      if (!heart || !root.contains(heart)) return;
      // a heart may sit inside a card's link
      event.preventDefault();
      toggle(heart);
    });
  }
  paint();
  listen();
  // signed in already (a later block): the saved products are in the storage
  if (started) started.then(paint).then(completePending);
  const refresh = () => {
    paint();
    if (started) started.then(completePending);
  };
  return { toggle, refresh };
}
