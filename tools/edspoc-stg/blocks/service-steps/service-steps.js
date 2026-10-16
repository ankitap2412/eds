/*
 * Service Steps
 * Promo band for the painting service: a looping background video under a teal gradient, the
 * service logo, call-to-action buttons and numbered steps. Migrated from `.servicesteps`.
 *
 * Authoring (2 columns). Optional reserved rows, recognised by their label:
 *   | Video   | link to the background video (.mp4)                    |
 *   | Logo    | logo image, optional mobile image (below 992px)        |
 *   | Buttons | links; a link to the safe painting service page opens  |
 *   |         | the site-visit pop-up, other links open in a new tab   |
 *   | Heading | steps heading text                                     |
 * plus one row per step: | icon image | step text |
 *
 * The video loads only when the band scrolls near view, pauses while it is off screen and is
 * skipped for people who prefer reduced motion.
 */
import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {trackEvent, pushAdobeCtaClickEvent} from '../../scripts/analytics_1.js';

const RESERVED = ['video', 'logo', 'buttons', 'heading'];
const DESKTOP_MEDIA = '(min-width: 992px)';
const SITE_VISIT_PATH = '/services/asian-paints-safe-painting-service';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Whether a link points to the safe painting service page, which opens the site-visit pop-up.
 * Matches the path in any form authors paste: /services/..., the AEM path
 * /content/ap/en/home/services/..., with or without .html or a trailing slash.
 */
function isSiteVisitLink(href) {
  const path = new URL(href, window.location.href).pathname.replace(/(\.html)?\/?$/, '');
  return path.endsWith(SITE_VISIT_PATH);
}

function buildVideo(content, block) {
  const link = content.querySelector('a[href]');
  if (!link) return null;
  const video = document.createElement('video');
  video.className = 'service-steps-video';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  moveInstrumentation(link, video);

  if (REDUCED_MOTION.matches) return video;
  // load and play near the viewport only, pause off screen (the file is large)
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!video.src) video.src = link.href;
      video.play().catch(() => {});
    } else if (video.src) {
      video.pause();
    }
  }, { rootMargin: '200px 0px' }).observe(block);
  return video;
}

/** Art-directed logo: desktop image from 992px, optional mobile image below. */
function buildLogo(content) {
  const [desktop, mobile] = [...content.querySelectorAll('picture img')];
  if (!desktop) return null;
  // base picture = mobile image (or desktop when there is none); desktop sources win from 992px
  const small = mobile || desktop;
  const picture = createOptimizedPicture(small.src, desktop.alt || '', false, [{ width: '240' }]);
  if (mobile) {
    const wide = createOptimizedPicture(desktop.src, '', false, [
      { media: DESKTOP_MEDIA, width: '400' },
      { width: '240' },
    ]);
    picture.prepend(...wide.querySelectorAll(`source[media="${DESKTOP_MEDIA}"]`));
  }
  moveInstrumentation(desktop, picture.querySelector('img'));
  const logo = document.createElement('div');
  logo.className = 'service-steps-logo';
  logo.append(picture);
  return logo;
}

/*
 * "Book a FREE Site Visit" pop-up. The host's own one first: the stage project opens its lead
 * form with its modal block (blocks/modal openModal) and the form page its header CTA points to,
 * like that header, so every CTA on the page opens the same form. Without a modal block (this
 * project) it is this project's form (scripts/site-visit-form.js); if neither loads, the link.
 */
const DEFAULT_SITE_VISIT_MODAL = '/eds/forms/book-free-site-visit';

async function openSiteVisitPopup(opener, fallback) {
  const modalPath = document.querySelector('.trigger-book-free-site-visit-modal[data-modal-path]')?.dataset.modalPath
    || getMetadata('site-visit-modal') || DEFAULT_SITE_VISIT_MODAL;
  try {
    // the host project's modal block (not in this project, so not resolvable here)
    // eslint-disable-next-line import/no-unresolved
    const { openModal } = await import('../modal/modal.js');
    await openModal(modalPath);
    return;
  } catch {
    // no modal block (or no form page) on this site: this project's form
  }
  try {
    const { default: openSiteVisitForm } = await import('../../scripts/site-visit-form.js');
    const dialog = await openSiteVisitForm();
    dialog.addEventListener('close', () => opener.focus(), { once: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('site visit form failed to load', error);
    window.location.href = fallback;
  }
}

function openSiteVisit(button, fallback, parentTitle) {
  button.addEventListener('click', () => {
    trackEvent('custom_cta_click', {
      cta_: button.textContent.trim(),
      parentTitle,
    });
    pushAdobeCtaClickEvent({
      event: 'custom_cta_click',
      cta: button.textContent.trim(),
      parentTitle,
    });
    openSiteVisitPopup(button, fallback);
  });
}

function buildButtons(content, parentTitle) {
  const links = [...content.querySelectorAll('a[href]')];
  if (!links.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'service-steps-buttons';
  links.forEach((link, index) => {
    const label = link.textContent.trim();
    const siteVisit = isSiteVisitLink(link.href);
    let button;
    if (siteVisit) {
      // opens the lead form pop-up, as on the source; the link is the fallback
      button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.textContent = label;
      openSiteVisit(button, link.href, parentTitle);
    } else {
      button = document.createElement('a');
      button.href = link.href;
      button.target = '_blank';
      button.rel = 'noopener';
      button.textContent = label;
      button.addEventListener('click', () => {
        trackEvent('custom_cta_click', {
          cta_: label,
          redirectionLink: link.href,
          parentTitle,
        });

        pushAdobeCtaClickEvent({
          event: 'custom_cta_click',
          cta: label,
          destinationUrl: link.href,
          parentTitle: parentTitle,
        });
      });

      const pdf = /\.pdf$/i.test(new URL(link.href).pathname);
      const note = document.createElement('span');
      note.className = 'service-steps-sr-only';
      note.textContent = pdf ? ' (PDF, opens in a new tab)' : ' (opens in a new tab)';
      button.append(note);
      if (pdf) button.classList.add('service-steps-download');
    }
    button.classList.add('service-steps-button', index ? 'secondary' : 'primary');
    moveInstrumentation(link, button);
    wrap.append(button);
  });
  return wrap;
}

function buildSteps(rows) {
  const list = document.createElement('ol');
  list.className = 'service-steps-list';
  rows.forEach(({ row, iconCell, textCell }) => {
    const item = document.createElement('li');
    moveInstrumentation(row, item);
    const img = iconCell?.querySelector('img');
    if (img) {
      // the icons carry the step numbers; the ordered list already announces them
      const picture = createOptimizedPicture(img.src, '', false, [{ width: '160' }]);
      picture.classList.add('service-steps-icon');
      item.append(picture);
    }
    const text = document.createElement('p');
    text.textContent = textCell?.textContent.trim() || '';
    item.append(text);
    list.append(item);
  });
  return list;
}

export default function decorate(block) {
  const parts = {};
  const steps = [];
  [...block.children].forEach((row) => {
    const [first, second] = row.children;
    if (!first) return;
    const key = first.textContent.trim().toLowerCase();
    if (second && RESERVED.includes(key) && !first.querySelector('img')) {
      if (!parts[key]) parts[key] = { row, content: second };
      return;
    }
    const iconCell = [first, second].find((cell) => cell?.querySelector('img'));
    const textCell = [first, second]
      .find((cell) => cell && cell !== iconCell && cell.textContent.trim());
    if (iconCell || textCell) steps.push({ row, iconCell, textCell });
  });

  const video = parts.video && buildVideo(parts.video.content, block);
  const logo = parts.logo && buildLogo(parts.logo.content);
  const headingText = parts.heading?.content.textContent.trim();
  const buttons = parts.buttons && buildButtons(parts.buttons.content, headingText);
  let heading = null;

  if (headingText) {
    heading = document.createElement('h2');
    heading.className = 'service-steps-heading';
    heading.textContent = headingText;
    moveInstrumentation(parts.heading.row, heading);
  }
  [[logo, 'logo'], [buttons, 'buttons']].forEach(([el, key]) => {
    if (el) moveInstrumentation(parts[key].row, el);
  });

  const left = document.createElement('div');
  left.className = 'service-steps-intro';
  left.append(...[logo, buttons].filter(Boolean));
  const right = document.createElement('div');
  right.className = 'service-steps-steps';
  right.append(...[heading, steps.length && buildSteps(steps)].filter(Boolean));

  const overlay = document.createElement('div');
  overlay.className = 'service-steps-overlay';
  const inner = document.createElement('div');
  inner.className = 'service-steps-inner';
  inner.append(left, right);
  block.replaceChildren(...[video, overlay, inner].filter(Boolean));
}
