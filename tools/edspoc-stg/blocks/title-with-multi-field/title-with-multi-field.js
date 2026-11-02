// author label rows in the DA table; removed before rendering
const LABELS = [
  'Section title',
  'Pack image',
  'Pack size',
  'Price',
  'Tax note',
  'Disclaimer',
];

function removeLabelRows(block, labels) {
  const norm = (t) => t.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const known = new Set(labels.map(norm));
  [...block.children].forEach((row) => {
    if (row.querySelector('picture, img')) return;
    const texts = [...row.children].map((cell) => cell.textContent.trim()).filter(Boolean);
    if (texts.length && texts.every((t) => known.has(norm(t)))) row.remove();
  });
}

export default function decorate(block) {
  removeLabelRows(block, LABELS);
  const rows = [...block.children];

  if (rows.length < 3) return;

  const headingRow = rows.shift();
  const disclaimerRow = rows.pop();

  const headingText = headingRow.children[0]?.textContent.trim() || '';

  const wrapper = document.createElement('div');
  wrapper.classList.add('pack-sizes');

  const heading = document.createElement('h2');
  heading.classList.add('pack-sizes-heading');
  heading.textContent = headingText;

  wrapper.appendChild(heading);

  const cardsContainer = document.createElement('div');
  cardsContainer.classList.add('pack-sizes-cards');

  rows.forEach((row) => {
    const cols = [...row.children];

    const image = cols[0]?.querySelector('picture');
    const size = cols[1]?.textContent.trim() || '';
    const price = cols[2]?.textContent.trim() || '';
    const tax = cols[3]?.textContent.trim() || '';

    const card = document.createElement('div');
    card.classList.add('pack-sizes-card');

    if (size === '0.5 L') {
      card.classList.add('size-0-5');
    } else if (size === '1 L') {
      card.classList.add('size-1');
    } else if (size === '4 L') {
      card.classList.add('size-4');
    } else if (size === '10 L') {
      card.classList.add('size-10');
    } else if (size === '20 L') {
      card.classList.add('size-20');
    }

    const imageWrapper = document.createElement('div');
    imageWrapper.classList.add('pack-sizes-image');

    if (image) {
      imageWrapper.appendChild(image.cloneNode(true));
    }

    const sizeLabel = document.createElement('div');
    sizeLabel.classList.add('pack-sizes-size');
    sizeLabel.textContent = size;

    imageWrapper.appendChild(sizeLabel);

    const priceEl = document.createElement('div');
    priceEl.classList.add('pack-sizes-price');
    priceEl.textContent = price;

    const taxEl = document.createElement('div');
    taxEl.classList.add('pack-sizes-tax');
    taxEl.textContent = tax;

    card.append(
      imageWrapper,
      priceEl,
      taxEl,
    );

    cardsContainer.appendChild(card);
  });

  wrapper.appendChild(cardsContainer);

  const note = document.createElement('div');
  note.classList.add('pack-sizes-note');
  const noteText = disclaimerRow.children[0]?.textContent.trim() || '';
  // only the leading asterisk is red (::first-letter would also colour the "P")
  if (noteText.startsWith('*')) {
    const asterisk = document.createElement('span');
    asterisk.classList.add('pack-sizes-asterisk');
    asterisk.textContent = '*';
    note.append(asterisk, noteText.slice(1));
  } else {
    note.textContent = noteText;
  }

  wrapper.appendChild(note);

  block.innerHTML = '';
  block.appendChild(wrapper);
}
