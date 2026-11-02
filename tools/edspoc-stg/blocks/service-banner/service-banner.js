/*
** Authoring format **
Col 1 contains the desktop image
Col 2 contains the mobile image (optional, falls back to Col 1)
Col 3 contains the content (heading, text, CTA buttons); its text paragraphs
get the "content-text" class (CTA paragraphs are already .button-container)
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const wrapper = block.firstElementChild;
  wrapper.classList.add('wrapper');

  const cells = [...wrapper.children];
  const banner = cells[0];
  // content is always the last column (also keeps older 2-column banners working)
  const content = cells[cells.length - 1];
  const desktopImg = banner.querySelector('img');
  const mobileImg = cells.length > 2 ? cells[1].querySelector('img') : null;

  // one <picture>: mobile image by default, desktop image from 992px up
  let picture = banner.querySelector('picture');
  if (desktopImg && mobileImg) {
    const alt = desktopImg.alt || mobileImg.alt || '';
    // keep the page's loading decision (eager only when it's the LCP image)
    const eager = desktopImg.loading === 'eager';
    picture = createOptimizedPicture(mobileImg.src, alt, eager, [{ width: '750' }]);
    const desktopPicture = createOptimizedPicture(desktopImg.src, alt, eager, [
      { media: '(min-width: 992px)', width: '2000' },
    ]);
    picture.prepend(...desktopPicture.querySelectorAll('source[media]'));
  }

  // drop the mobile-image column now that it's merged into the picture
  if (cells.length > 2) cells[1].remove();

  banner.innerHTML = '';
  banner.className = 'banner';
  content.className = 'content';
  content.querySelectorAll('p:not(.button-container)').forEach((p) => p.classList.add('content-text'));

  if (picture) banner.appendChild(picture);

  // ===== FIX START: swap-image-with-cta (and the apex-ultima-service-banner section)
  // shows the desktop image from 768px, like live =====
  if (block.classList.contains('swap-image-with-cta')
    || block.closest('.apex-ultima-service-banner')) {
    banner.querySelectorAll('source[media="(min-width: 992px)"]').forEach((source) => {
      source.media = '(min-width: 768px)';
    });
  }
  // ===== FIX END =====

  content.querySelectorAll('.button-container a.button').forEach((cta) => {
    // The global bindButtonContainerTracking() (decorateMain) already binds
    // a click handler to every .button-container a.button and sets
    // dataset.analyticsBound. Respect that shared flag so we don't fire a
    // duplicate cta_link_text/custom_cta_click for the same click.
    if (cta.dataset.analyticsBound === 'true') return;
    if (cta.dataset.serviceBannerAnalyticsBound === 'true') return;

    cta.dataset.analyticsBound = 'true';
    cta.dataset.serviceBannerAnalyticsBound = 'true';
    cta.addEventListener('click', () => {
      const ctaLink = cta.href || '';
      const btnTitle = cta.textContent.trim();
      const parentTitle = content.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || 'service-banner';

  

      trackEvent('cta_link_text', {
        cta_: btnTitle,
        param1: ctaLink,
        parentTitle,
      });
      pushAdobeCtaClickEvent({
        cta:btnTitle,
        destinationUrl: ctaLink,
        parentTitle,
        event: 'cta_link_text',
      });

    });
  });
}
