/* global WebImporter */

/**
 * Parser for the choose-plan block, choose-plan-v2 look.
 * Source: AEM choosePlan component (`.choosePlanBlock`).
 * Output rows:
 *   [Choose Plan (choose-plan-v2)]
 *   [heading]
 *   [header image + plan name | label + list per group | button link]   (one row per plan)
 */
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() || '';

export default function parse(element, { document, url }) {
  const cells = [['Choose Plan (choose-plan-v2)']];

  const title = text(element.querySelector('.choosePlanBlock__wrapper--title'));
  if (title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    cells.push([h2]);
  }

  element.querySelectorAll('.choosePlanBlock__wrapper--banners--cards').forEach((card) => {
    const nameCell = document.createElement('div');
    const srcImg = card.querySelector('.choosePlanBlock__wrapper--banners--cards__iconAndText img');
    if (srcImg?.getAttribute('src')) {
      const img = document.createElement('img');
      img.src = new URL(srcImg.getAttribute('src'), url).href;
      img.alt = '';
      nameCell.append(img);
    }
    const name = document.createElement('p');
    name.textContent = text(card.querySelector('.main-sub-title'));
    nameCell.append(name);

    const features = document.createElement('div');
    card.querySelectorAll('.choosePlanBlock__wrapper--banners--cards--lists').forEach((group) => {
      const label = text(group.querySelector('.sub-title'));
      if (label) {
        const p = document.createElement('p');
        p.textContent = label;
        features.append(p);
      }
      const ul = document.createElement('ul');
      group.querySelectorAll('li').forEach((srcLi) => {
        const li = document.createElement('li');
        li.textContent = text(srcLi);
        ul.append(li);
      });
      if (ul.children.length) features.append(ul);
    });

    const ctaCell = document.createElement('div');
    const srcLink = card.querySelector('.bookThisPlan a[href]');
    if (srcLink) {
      const a = document.createElement('a');
      a.href = srcLink.getAttribute('href');
      a.textContent = text(srcLink);
      ctaCell.append(a);
    }

    cells.push([nameCell, features, ctaCell]);
  });

  element.replaceWith(WebImporter.DOMUtils.createTable(cells, document));
}
