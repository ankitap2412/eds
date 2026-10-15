import { createOptimizedPicture } from '../../scripts/aem.js';
import { triggerCTAClickWithLinkAndTitle, trackEvent, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

/**
 * Two Column Image
 * Side-by-side image cards with an optional overlaid title, subtitle and CTA.
 *
 * Authoring model (first row is a header row and is ignored):
 *   Desktop image | Mobile image | Title | Sub title | CTA Label | Redirection link
 *   | Open in new tab
 *
 * Title, sub title and CTA are optional. "Open in new tab" defaults to false;
 * when set to true, the redirection link opens in a new tab. When a redirection link is authored
 * without a CTA label, the whole image becomes the link.
 */

const HEADER_LABELS = ['desktop image', 'mobile image', 'title'];

const isHeaderRow = (row) => !row.querySelector('img')
  && HEADER_LABELS.includes(row.children[0]?.textContent.trim().toLowerCase());

function getLink(cell) {
  const a = cell?.querySelector('a');
  if (a) return a.getAttribute('href');
  return cell?.textContent.trim() || '';
}

function buildPicture(desktopImg, mobileImg) {
  const mobile = mobileImg || desktopImg;
  const desktop = desktopImg || mobileImg;
  const alt = desktop.alt || mobile.alt || '';
  const picture = createOptimizedPicture(mobile.src, alt, false, [{ width: '750' }]);
  const desktopPicture = createOptimizedPicture(desktop.src, alt, false, [
    { media: '(min-width: 900px)', width: '1200' },
    { width: '750' },
  ]);
  picture.prepend(...desktopPicture.querySelectorAll('source[media]'));
  return picture;
}

function openInNewTab(link) {
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
}

function buildCta(label, href, newTab) {
  const cta = document.createElement('a');
  cta.href = href;
  if (newTab) openInNewTab(cta);
  cta.className = 'two-column-image-cta';
  cta.textContent = label;
  const icon = document.createElement('img');
  icon.src = '/eds/icons/arrow-icon-new.svg';
  icon.alt = 'arrow icon';
  icon.className = 'link-icon';
  cta.append(icon);
  return cta;
}

function buildCard(row) {
  const [
    desktopCell, mobileCell, titleCell, subtitleCell, labelCell, linkCell, newTabCell, eventCell,
  ] = row.children;
  const desktopImg = desktopCell?.querySelector('img');
  const mobileImg = mobileCell?.querySelector('img');
  if (!desktopImg && !mobileImg) return null;

  const title = titleCell?.textContent.trim() || '';
  const subtitle = subtitleCell?.textContent.trim() || '';
  const label = labelCell?.textContent.trim() || '';
  const href = getLink(linkCell) || labelCell?.querySelector('a')?.getAttribute('href') || '';
  const newTab = newTabCell?.textContent.trim().toLowerCase() === 'true';

  const card = document.createElement('div');
  // a value in the Event column means the card tracks itself elsewhere
  const event = eventCell?.textContent.trim() || '';
  if (event) card.dataset.event = event;

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'image-wrapper';
  const picture = buildPicture(desktopImg, mobileImg);
  if (href) {
    // the image link makes the whole card clickable; when a CTA is also
    // rendered, keep it out of the tab order so the CTA is the single focus stop
    const link = document.createElement('a');
    link.href = href;
    if (newTab) openInNewTab(link);
    if (label) {
      link.tabIndex = -1;
      link.setAttribute('aria-hidden', 'true');
    }
    link.append(picture);
    imageWrapper.append(link);
  } else {
    imageWrapper.append(picture);
  }
  card.append(imageWrapper);
  if (href) card.classList.add('is-linked');

  if (title || subtitle || (label && href)) {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    const titleWrapper = document.createElement('div');
    if (title) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      titleWrapper.append(heading);
    }
    contentWrapper.append(titleWrapper);

    const subtitleWrapper = document.createElement('div');
    if (subtitle) {
      const p = document.createElement('p');
      p.textContent = subtitle;
      subtitleWrapper.append(p);
    }
    contentWrapper.append(subtitleWrapper);

    if (label && href) contentWrapper.append(buildCta(label, href, newTab));
    card.append(contentWrapper);
  }

  return card;
}

function bindAnalytics(block) {
  block.addEventListener('click', (event) => {
    const target = event.target.closest('.image-wrapper a, .content-wrapper a');
    if (!target || !block.contains(target)) return;
    const clickedCard = target.closest('.image-wrapper, .content-wrapper')?.parentElement;
    // on a card with an Event value: the image link fires that event, the CTA custom_cta_click
    const cardEvent = clickedCard?.dataset.event;
    const isImageClick = !!target.closest('.image-wrapper');
    // report clicks anywhere on a card with a CTA as a click on that CTA
    const cta = target.closest('.image-wrapper')
      ?.parentElement.querySelector('.two-column-image-cta') || target;

    const ctaLink = cta.getAttribute('href') || '';
    const btnTitle = Array.from(cta.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim() || cta.querySelector('img')?.alt?.trim() || 'CTA';

    const parentCard = cta.closest('.image-wrapper, .content-wrapper')?.parentElement;

    const ANALYTICS_OVERRIDES = [
      {
        match: 'home-colour-guide',
        parentTitle: 'Home Colour Guide',
      },
    ];
    const override = ANALYTICS_OVERRIDES.find((o) => ctaLink.includes(o.match));

    const parentTitle2 = override?.parentTitle?.trim()
     || parentCard?.querySelector('h3, p')?.textContent?.trim()
     || parentCard?.querySelector('.image-wrapper img')?.alt?.trim();

    const parentTitle = parentCard?.querySelector('h3, p')?.textContent?.trim()
      || parentCard?.querySelector('.image-wrapper img')?.alt?.trim()
      || '';

    if (cardEvent && isImageClick) {
      trackEvent(cardEvent, {
        parentTitle,
        redirectionLink: cta.href || ctaLink,
      });

      pushAdobeCtaClickEvent({
        title: parentTitle,
        parentTitle,
        destinationUrl: cta.href || ctaLink,
        event: cardEvent,
      });
      return;
    }

    if (cardEvent) {
      trackEvent('custom_cta_click', {
        cta_: btnTitle,
        parentTitle,
        redirectionLink: cta.href || ctaLink,
      });

      pushAdobeCtaClickEvent({
        cta: btnTitle,
        parentTitle,
        destinationUrl: cta.href || ctaLink,
        event: 'custom_cta_click',
      });
      return;
    }

    triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle2);
  });
}

/**
 * Keeps all cards the same width and height: every image is drawn at the
 * aspect ratio of the shortest one, so a taller image is resized (not cropped)
 * to match it. Re-run on every image load, which also fires when the browser
 * switches between the desktop and mobile sources at the breakpoint.
 */
function equalizeImageSizes(block) {
  const imgs = [...block.querySelectorAll('.image-wrapper img')];
  if (imgs.length < 2) return;
  const update = () => {
    if (imgs.some((img) => !img.complete || !img.naturalWidth || !img.naturalHeight)) return;
    const widest = imgs.reduce((a, b) => (
      b.naturalWidth / b.naturalHeight > a.naturalWidth / a.naturalHeight ? b : a));
    block.style.setProperty('--two-column-image-ratio', `${widest.naturalWidth} / ${widest.naturalHeight}`);
    // tools-redirection: every card is as tall as the shortest image file (see the CSS)
    const shortest = Math.min(...imgs.map((img) => img.naturalHeight));
    block.style.setProperty('--two-column-image-height', `${shortest}px`);
  };
  imgs.forEach((img) => img.addEventListener('load', update));
  update();
}
/* ==================== trending-articles-variant : start ==================== */

/**
 * trending-articles-variant: the "You may also like" cards of the asianpaints.com product pages
 * (trendingArticlesSec), with the rich text above them (the source's rte text component).
 *
 * Authoring: a text row before or after the header row, e.g. a heading "You may also like" with
 * the highlighted words in bold ("also like", drawn in the brand gradient); the image rows as
 * usual. The text keeps its authored markup (headings, paragraphs, bold, links).
 * As on the source, the desktop image is used from 768px.
 */
function decorateTrendingArticles(block, rows) {
  const textRow = rows.find((row) => !row.querySelector('img') && row.textContent.trim());
  if (textRow) {
    const intro = document.createElement('div');
    intro.className = 'two-column-image-intro';
    [...textRow.children].forEach((cell) => {
      // a single line arrives without a paragraph
      if (cell.querySelector(':scope > :is(p, h1, h2, h3, h4, h5, h6, ul, ol)')) {
        intro.append(...[...cell.children].filter((child) => child.textContent.trim()));
      } else if (cell.textContent.trim()) {
        const p = document.createElement('p');
        p.append(...cell.childNodes);
        intro.append(p);
      }
    });
    block.prepend(intro);
  }
  block.querySelectorAll('.image-wrapper source[media="(min-width: 900px)"]').forEach((source) => {
    source.media = '(min-width: 768px)';
  });
}

/* ==================== trending-articles-variant : end ==================== */

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children].filter((row) => !isHeaderRow(row));
  const cards = rows.map(buildCard).filter(Boolean);
  block.replaceChildren(...cards);
  equalizeImageSizes(block);
  bindAnalytics(block);
  if (block.classList.contains('trending-articles-variant')) decorateTrendingArticles(block, rows);
}
