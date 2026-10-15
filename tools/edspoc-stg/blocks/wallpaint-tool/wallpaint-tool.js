/**
 * Wall Paint Tool — a 3-step guided flow. All content is authored in DA.
 *
 * Steps are separated in the DA table by a marker row whose only text is
 * "Step 1", "Step 2" or "Step 3" (so authors are never confused about which
 * screen a row belongs to). Rows before the first marker fall into Step 1.
 *
 * STEP 1 — heading + mandatory questions
 *   image row     : desktop background | mobile background (shared by all steps)
 *   heading row   : rich text (a bold run becomes the highlighted colour text;
 *                   with none, the middle line of the heading is highlighted)
 *   question rows : question text | bullet list of options [| display|hide]
 *   cta row       : "CTA" | button label            (authorable button text)
 *
 * STEP 2 — lead form
 *   heading row    : rich text
 *   subheading row : plain text
 *   field labels   : Name | Email | Phone | Pincode          (column labels)
 *   field holders  : Enter your name | Enter your Email | …   (placeholders)
 *   whatsapp row   : Update me on WhatsApp | display|hide
 *   question rows  : question text | bullet list | display|hide
 *   consent row    : rich text with Terms / Privacy links
 *   cta row        : "CTA" | button label
 *   campaign row   : "Campaign ID" | id   (optional, sent with the lead)
 *   node row       : "Node" | path        (optional, defaults to the page path)
 *
 * On submit the lead is sent exactly like a BHPS form in blocks/form/form.js
 * (submitLeadFromForm -> save to DB, then Salesforce), then the details are
 * saved to the CCFormFields cookie and Step 3 opens.
 *
 * STEP 3 — recommendations (placeholder heading/text for now)
 *
 * @param {Element} block The block element
 */

import { loadScript } from '../../scripts/aem.js';
import { trackPdfDownload } from '../../scripts/analytics_1.js';
import {
  submitLeadFromForm, checkCookieValues, setFormFieldsToCookie, getCookieValues,
} from '../../scripts/form-submit-common.js';
import { BETA_DOMAIN } from '../../scripts/environment.js';

// Normalise a label into a lowercase, hyphen-separated token.
// Used both to derive input `name`/`id`/CSS-class values and to match an
// authored label ("Semi Gloss") against a known key ("semi-gloss").
function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// finish options that render as gradient swatches (gradients live in the CSS)
const SWATCH_SLUGS = ['gloss', 'semi-gloss', 'matt'];

// turn a bold/italic run authored in DA into the gold highlight span
function buildHeadingHTML(sourceEl) {
  const clone = sourceEl.cloneNode(true);
  clone.querySelectorAll('strong, b, em').forEach((el) => {
    const span = document.createElement('span');
    span.className = 'color-text';
    span.innerHTML = el.innerHTML;
    el.replaceWith(span);
  });
  return clone.innerHTML;
}

// With no bold run authored, the gold goes on whichever words the browser
// lays out on the middle line of the heading (as the design: "Find your
// perfect / Wall Paint Product / with a few clicks."). The words are
// re-measured whenever the heading resizes or the web font arrives, since
// both move the line breaks.
function highlightMiddleLine(p) {
  const words = p.textContent.trim().split(/\s+/).map((word) => {
    const span = document.createElement('span');
    span.textContent = word;
    return span;
  });
  p.replaceChildren(...words.flatMap((span, i) => (i ? [' ', span] : [span])));

  const mark = () => {
    const lineTops = [...new Set(words.map((span) => span.offsetTop))];
    const middle = lineTops.length >= 3 ? lineTops[Math.floor((lineTops.length - 1) / 2)] : null;
    words.forEach((span) => span.classList.toggle('color-text', span.offsetTop === middle));
  };
  new ResizeObserver(mark).observe(p);
  document.fonts.ready.then(mark);
}

// Split the flat list of authored rows into per-step groups.
// A "Step N" marker row (a single cell reading e.g. "Step 2") starts a new
// group; every following row belongs to that step until the next marker.
// Rows that appear before any marker still form an implicit first group, so
// the block keeps working even if an author forgets the "Step 1" marker.
// Returns an array of row-arrays: [step1Rows, step2Rows, step3Rows].
function splitSteps(rows) {
  const steps = [];
  let current = null;
  rows.forEach((row) => {
    const isMarker = [...row.children].length <= 1 && /^step\s*\d+$/i.test(row.textContent.trim());
    if (isMarker) {
      current = [];
      steps.push(current);
      return;
    }
    if (!current) {
      current = [];
      steps.push(current);
    }
    current.push(row);
  });
  return steps;
}

// Read the optional visibility flag authors can put in a row's last cell.
// "display" -> render the element, "hide" -> omit it entirely.
// Returns null when the last cell is neither, so callers can tell an
// explicit flag apart from ordinary content.
function displayFlag(cells) {
  const last = cells[cells.length - 1]?.textContent.trim().toLowerCase();
  return last === 'display' || last === 'hide' ? last : null;
}

// build a radio-group fieldset from a question row
function buildQuestion(labelText, options, groupName) {
  const isSwatch = options.some((li) => SWATCH_SLUGS.includes(slug(li.textContent)));

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'wallpainttool-question';
  if (isSwatch) fieldset.classList.add('wallpainttool-question-swatch');

  const legend = document.createElement('legend');
  legend.className = 'wallpainttool-question-title';
  legend.textContent = labelText;
  fieldset.append(legend);

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'wallpainttool-options';

  options.forEach((li, oIndex) => {
    const value = li.textContent.trim();
    const id = `${groupName}-o${oIndex}`;
    const optSlug = slug(value);
    // An author can wrap an option's label in a link (e.g. Wood -> the wood
    // finish tool). Selecting that option opens the link in a new tab.
    const link = li.querySelector('a');
    const href = link ? link.getAttribute('href') : '';

    const optionLabel = document.createElement('label');
    optionLabel.className = 'wallpainttool-option';
    optionLabel.setAttribute('for', id);

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = groupName;
    input.id = id;
    input.value = value;
    input.required = true;
    if (href) {
      input.dataset.href = href;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        window.open(href, '_blank', 'noopener');
        // Link options only redirect; keep the previous selection highlighted.
        input.checked = false;
        if (optionsWrap.prevChecked) optionsWrap.prevChecked.checked = true;
      });
    }

    if (!href) {
      input.addEventListener('change', () => {
        optionsWrap.prevChecked = input;
        optionsWrap.querySelectorAll('.wallpainttool-option').forEach((el) => {
          el.classList.toggle('clicked-radio', el.contains(input) && input.checked);
        });
      });
    }

    optionLabel.append(input);

    if (isSwatch && SWATCH_SLUGS.includes(optSlug)) {
      const swatch = document.createElement('span');
      swatch.className = `wallpainttool-swatch wallpainttool-swatch-${optSlug}`;
      swatch.setAttribute('aria-hidden', 'true');
      optionLabel.append(swatch);
    }

    const text = document.createElement('span');
    text.className = 'wallpainttool-option-text';
    text.textContent = value;
    optionLabel.append(text);

    optionsWrap.append(optionLabel);
  });

  fieldset.append(optionsWrap);
  return fieldset;
}

/* ------------------------------------------------------------------ STEP 1 */
function buildStep1(rows) {
  let headingRow = null;
  let ctaText = 'Proceed';
  const questionRows = [];

  // Classify each authored row by what it contains, rather than by position,
  // so authors can reorder rows without breaking the block:
  //  - image row              -> skipped here (background is read at block level)
  //  - "CTA"/"Button" | label -> overrides the button text
  //  - row with a <ul>/<ol>   -> a question (label + options list)
  //  - first remaining text row -> the heading
  rows.forEach((row) => {
    if (row.querySelector('img, picture')) return; // bg handled at root level
    const cells = [...row.children];
    if (cells.length === 2 && ['cta', 'button'].includes(cells[0].textContent.trim().toLowerCase())) {
      ctaText = cells[1].textContent.trim() || ctaText;
    } else if (row.querySelector('ul, ol')) {
      questionRows.push(row);
    } else if (row.textContent.trim() && !headingRow) {
      headingRow = row;
    }
  });

  const screen = document.createElement('div');
  screen.className = 'wallpainttool-screen wallpainttool-screen-1';
  screen.dataset.step = '1';

  const left = document.createElement('div');
  left.className = 'wallpainttool-left';
  if (headingRow) {
    const source = headingRow.querySelector('p') || headingRow;
    left.innerHTML = `<div role="heading" aria-level="1" class="surface-layout-text-section" aria-label="${source.textContent.trim()}" tabindex="0"><p>${buildHeadingHTML(source)}</p></div>`;
    if (!left.querySelector('.color-text')) highlightMiddleLine(left.querySelector('p'));
  }

  const right = document.createElement('div');
  right.className = 'wallpainttool-right';

  const form = document.createElement('form');
  form.className = 'wallpainttool-form';
  form.setAttribute('novalidate', '');

  questionRows.forEach((row, qIndex) => {
    const cells = [...row.children];
    const optionsCell = cells[1] || cells[0];
    const options = [...optionsCell.querySelectorAll('li')];
    form.append(buildQuestion(cells[0].textContent.trim(), options, `wpt-s1-q${qIndex}`));
  });

  const proceed = document.createElement('button');
  proceed.type = 'submit';
  proceed.className = 'wallpainttool-proceed';
  proceed.disabled = true;
  proceed.innerHTML = `<span>${ctaText}</span>`;

  // Keep the CTA disabled until every question has a selected option.
  // One checked radio per group means checked-count === question-count.
  const total = questionRows.length;
  const update = () => {
    proceed.disabled = form.querySelectorAll('input[type="radio"]:checked').length < total;
  };
  form.addEventListener('change', update);
  update();

  form.append(proceed);
  right.append(form);
  screen.append(left, right);
  return { screen, form, proceed };
}

/* ------------------------------------------------------------------ STEP 2 */
// Infer the right input semantics from the authored field label so authors
// only type a label ("Phone") and get the correct type, on-screen keyboard
// (inputmode), autofill hint (autocomplete) and validation pattern for free.
// Note: pincode uses type="text" + inputmode="numeric" on purpose — type="number"
// strips leading zeros and adds unwanted spinner UI (see forms best-practices).
function fieldConfig(labelSlug) {
  if (labelSlug.includes('email')) return { type: 'email', autocomplete: 'email' };
  if (labelSlug.includes('phone') || labelSlug.includes('mobile')) {
    return {
      type: 'tel', autocomplete: 'tel-national', inputmode: 'numeric', pattern: '\\d{10}', maxlength: '10', prefix: '+91',
    };
  }
  if (labelSlug.includes('pin')) {
    return {
      type: 'text', autocomplete: 'postal-code', inputmode: 'numeric', pattern: '\\d{6}', maxlength: '6',
    };
  }
  return { type: 'text', autocomplete: 'name' };
}

// Ids for the lead inputs, keyed by the autocomplete hint fieldConfig() gives
// each one. Deliberately NOT the #enquire-* ids blocks/form and form-banner
// use: a page can hold this block and a form block together, and duplicate
// ids would make each form's <label for> point at the other form's inputs.
// The shared helpers in scripts/form-submit-common.js are handed these
// selectors instead (LEAD_SELECTORS).
const LEAD_FIELD_IDS = {
  name: 'wpt-enquire-name',
  email: 'wpt-enquire-email',
  'tel-national': 'wpt-enquire-mobile',
  'postal-code': 'wpt-enquire-pincode',
};

// The lead APIs only exist on the AEM site, not on the local `aem up` proxy,
// so on localhost they are called on the beta domain instead (same paths as
// DEFAULT_ENDPOINTS in form-submit-common.js). Elsewhere the defaults
// (same-origin, relative paths) are used.
const IS_LOCALHOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const LEAD_ENDPOINTS = IS_LOCALHOST ? {
  saveToDB: `https://${BETA_DOMAIN}/apcolourcatalogue/ccforms.saveleadform.json`,
  pushToSalesforce: `https://${BETA_DOMAIN}/apcolourcatalogue/ccforms/salesforce.leadstosalesforce.json`,
} : undefined;

const LEAD_SELECTORS = {
  name: `#${LEAD_FIELD_IDS.name}`,
  email: `#${LEAD_FIELD_IDS.email}`,
  mobile: `#${LEAD_FIELD_IDS['tel-national']}`,
  pincode: `#${LEAD_FIELD_IDS['postal-code']}`,
};

// BHPS question names/values expected by buildLeadPayload() (form-submit-common):
// the 1st question's answer is sent as `remarks`, the 2nd as `answer`.
const BHPS_QUESTION_NAMES = [
  'NEW_CUSTOM_CHECKBOX_customer_response_one',
  'NEW_CUSTOM_CHECKBOX_customer_response_two',
];

// As in form.js: "Immediate" and "Within a month" are sent as one merged
// value the backend expects.
function bhpsQuestionOneValue(label) {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'immediate' || normalized === 'within a month') {
    return 'Immediate/Within 1 Month';
  }
  return label;
}

// ---------- Step 2 field validation ----------
// Same rules, messages and timing as blocks/form/form.js
// (getValidationMessage / validateInputField / showFieldError /
// clearFieldError / bindNumericInputFilter): a field is checked when it loses
// focus, re-checked as the user types once it is in error, and every field is
// checked on submit. The field type comes from its autocomplete hint
// (fieldConfig) rather than its id/name, so it works whatever the author
// labels the column.
function getValidationMessage(input) {
  const value = input.value.trim();
  if (!value) return 'Field is required';
  if (input.autocomplete === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Email is invalid';
  }
  if (input.autocomplete === 'postal-code' && !/^\d{6}$/.test(value)) {
    return 'Enter a valid 6 digit Zip Code';
  }
  if (input.autocomplete === 'tel-national' && !/^\d{10}$/.test(value)) {
    return 'Phone number is invalid';
  }
  return '';
}

function validateInputField(input) {
  const field = input.closest('.wallpainttool-field');
  const errorEl = field.querySelector('.wallpainttool-field-error');
  const message = getValidationMessage(input);
  errorEl.textContent = message;
  field.classList.toggle('has-error', !!message);
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  return !message;
}

// A Step 2 radio question is required: valid once one option is picked.
// Mirrors validateDisclaimerGroup in form.js (same "Field is required" text).
function validateQuestion(fieldset) {
  const valid = !!fieldset.querySelector('input[type="radio"]:checked');
  fieldset.querySelector('.wallpainttool-field-error').textContent = valid ? '' : 'Field is required';
  fieldset.classList.toggle('has-error', !valid);
  return valid;
}

// digits only for phone / pincode, as typed or pasted
function bindNumericInputFilter(input) {
  input.addEventListener('input', () => {
    const numericValue = input.value.replace(/\D/g, '');
    if (input.value !== numericValue) input.value = numericValue;
  });
}

function buildStep2(rows) {
  const screen = document.createElement('div');
  screen.className = 'wallpainttool-screen wallpainttool-screen-2';
  screen.dataset.step = '2';
  if (!rows || !rows.length) return { screen, form: null, skipForm: false };

  let ctaText = 'View Recommendations';
  let skipForm = false; // "Skip Form | true" bypasses Step 2 entirely
  let campaignId = ''; // "Campaign ID | <id>" (utm_campaign in the URL wins)
  let node = ''; // "Node | <path>" sent as the lead's node
  const textRows = []; // single-cell text rows -> heading + subheading (in order)
  const gridRows = []; // multi-cell rows -> [0] field labels, [1] placeholders
  const questionRows = []; // rows containing an options list -> radio questions
  let whatsapp = null; // the "Update me on WhatsApp" opt-in row, if present
  let consentRow = null; // the legal/consent paragraph (identified by its links)

  // Bucket every row by shape/content. Order matters: the checks are arranged
  // most-specific first so, e.g., the consent paragraph (which has links) is
  // caught before the generic multi-cell "grid row" branch.
  rows.forEach((row) => {
    const cells = [...row.children];
    const flag = displayFlag(cells);
    if (cells.length === 2 && slug(cells[0].textContent) === 'skip-form') {
      skipForm = cells[1].textContent.trim().toLowerCase() === 'true';
    } else if (cells.length === 2 && slug(cells[0].textContent) === 'campaign-id') {
      campaignId = cells[1].textContent.trim();
    } else if (cells.length === 2 && slug(cells[0].textContent) === 'node') {
      node = cells[1].textContent.trim();
    } else if (cells.length === 2 && ['cta', 'button'].includes(cells[0].textContent.trim().toLowerCase())) {
      ctaText = cells[1].textContent.trim() || ctaText;
    } else if (row.querySelector('ul, ol')) {
      questionRows.push({ cells, flag });
    } else if (row.querySelector('a') || row.textContent.trim().length > 120) {
      // links (Terms/Privacy) or a long paragraph => the consent text
      consentRow = row;
    } else if (flag && cells.length === 2) {
      // "<label> | display|hide" => the WhatsApp opt-in row
      whatsapp = { label: cells[0].textContent.trim(), show: flag === 'display' };
    } else if (cells.length >= 2) {
      // remaining multi-cell rows are the field labels row then placeholders row
      gridRows.push(cells);
    } else if (row.textContent.trim()) {
      textRows.push(row);
    }
  });

  const card = document.createElement('div');
  card.className = 'wallpainttool-card';

  const form = document.createElement('form');
  form.className = 'wallpainttool-form2';
  // custom inline errors (as in form.js) replace the browser's bubbles
  form.setAttribute('novalidate', '');

  // heading + subheading (first two single-cell text rows)
  const header = document.createElement('div');
  header.className = 'wallpainttool-form2-header';
  if (textRows[0]) {
    const src = textRows[0].querySelector('p') || textRows[0];
    header.innerHTML = `<h2 class="wallpainttool-form2-title">${buildHeadingHTML(src)}</h2>`;
  }
  if (textRows[1]) {
    const p = document.createElement('p');
    p.className = 'wallpainttool-form2-sub';
    p.textContent = textRows[1].textContent.trim();
    header.append(p);
  }

  // Build the text inputs by pairing the two grid rows column-by-column:
  // labels row supplies the accessible <label>, placeholders row supplies the
  // input placeholder. Column N of the labels row maps to column N of the
  // placeholders row (e.g. "Phone" + "Enter mobile number").
  const grid = document.createElement('div');
  grid.className = 'wallpainttool-fields';
  const labels = gridRows[0] || [];
  const holders = gridRows[1] || [];
  labels.forEach((labelCell, i) => {
    const labelText = labelCell.textContent.trim();
    const placeholder = holders[i] ? holders[i].textContent.trim() : '';
    // skip columns with no placeholder (e.g. the blank "Book FREE Site Visit" column)
    if (!labelText || !placeholder) return;
    const cfg = fieldConfig(slug(labelText));
    const name = slug(labelText) || `field-${i}`;
    const id = LEAD_FIELD_IDS[cfg.autocomplete] || `wpt-f-${name}`;

    const field = document.createElement('div');
    field.className = `wallpainttool-field wallpainttool-field-${name}`;

    // The visible cue is the placeholder, but a real <label> is still emitted
    // so the field stays labelled for screen readers. Once the field has a
    // value the label floats up into the top border (CSS, .wallpainttool-float-label).
    const label = document.createElement('label');
    label.className = 'wallpainttool-float-label';
    label.setAttribute('for', id);
    label.textContent = labelText;

    const control = document.createElement('div');
    control.className = 'wallpainttool-control';
    if (cfg.prefix) {
      const prefix = document.createElement('span');
      prefix.className = 'wallpainttool-tel-prefix';
      prefix.textContent = cfg.prefix;
      control.append(prefix);
    }

    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.type = cfg.type;
    input.placeholder = placeholder;
    input.required = true;
    input.autocomplete = cfg.autocomplete;
    if (cfg.inputmode) input.inputMode = cfg.inputmode;
    if (cfg.pattern) input.pattern = cfg.pattern;
    if (cfg.maxlength) input.maxLength = Number(cfg.maxlength);
    if (cfg.inputmode === 'numeric') bindNumericInputFilter(input);
    control.append(input);

    const errorEl = document.createElement('div');
    errorEl.className = 'wallpainttool-field-error';
    errorEl.id = `${id}-error`;
    errorEl.setAttribute('aria-live', 'polite');
    input.setAttribute('aria-describedby', errorEl.id);

    input.addEventListener('blur', () => validateInputField(input));
    input.addEventListener('input', () => {
      if (field.classList.contains('has-error')) validateInputField(input);
    });

    field.append(label, control, errorEl);
    grid.append(field);
  });

  // whatsapp opt-in checkbox (only when authored to "display")
  let whatsappEl = null;
  if (whatsapp && whatsapp.show) {
    whatsappEl = document.createElement('label');
    whatsappEl.className = 'wallpainttool-whatsapp';
    whatsappEl.innerHTML = '<input type="checkbox" name="whatsapp-optin" checked>';
    const span = document.createElement('span');
    span.textContent = whatsapp.label;
    whatsappEl.append(span);
  }

  // radio questions (only those authored to "display")
  const questionsWrap = document.createElement('div');
  questionsWrap.className = 'wallpainttool-form2-questions';
  questionRows.forEach(({ cells, flag }, qIndex) => {
    if (flag === 'hide') return;
    const optionsCell = cells[1] || cells[0];
    const options = [...optionsCell.querySelectorAll('li')];
    const groupName = BHPS_QUESTION_NAMES[qIndex] || `wpt-s2-q${qIndex}`;
    const fieldset = buildQuestion(cells[0].textContent.trim(), options, groupName);
    if (qIndex === 0) {
      fieldset.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.value = bhpsQuestionOneValue(radio.value);
      });
    }

    // mandatory: red "*" after the question (as form.js's .form-global__required)
    // and an inline error under the options, cleared as soon as one is picked
    const required = document.createElement('span');
    required.className = 'wallpainttool-required';
    required.setAttribute('aria-hidden', 'true');
    required.textContent = ' *';
    fieldset.querySelector('legend').append(required);

    const errorEl = document.createElement('div');
    errorEl.className = 'wallpainttool-field-error';
    errorEl.setAttribute('aria-live', 'polite');
    fieldset.append(errorEl);
    fieldset.addEventListener('change', () => validateQuestion(fieldset));

    questionsWrap.append(fieldset);
  });

  // consent text (links preserved)
  let consentEl = null;
  if (consentRow) {
    consentEl = document.createElement('p');
    consentEl.className = 'wallpainttool-consent';
    const src = consentRow.querySelector('p') || consentRow;
    consentEl.innerHTML = src.innerHTML;
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'wallpainttool-proceed wallpainttool-proceed-2';
  submit.innerHTML = `<span>${ctaText}</span>`;

  form.append(grid);
  if (whatsappEl) form.append(whatsappEl);
  if (questionsWrap.children.length) form.append(questionsWrap);
  if (consentEl) form.append(consentEl);
  // shown when the lead could not be sent (form.js shows an error popup)
  const submitError = document.createElement('p');
  submitError.className = 'wallpainttool-submit-error';
  submitError.setAttribute('role', 'alert');
  submitError.hidden = true;
  submitError.textContent = 'Something went wrong. Please try again.';

  form.append(submitError, submit);

  card.append(header, form);
  screen.append(card);
  return {
    screen, form, submit, submitError, skipForm, campaignId, node,
  };
}

/* ------------------------------------------------------------------ STEP 3 */
// Base host for the product packshots / detail pages returned by the API
// (the API returns site-relative paths like "/content/dam/...").
const WPT_ASSET_BASE = 'https://www.asianpaints.com';

// Default endpoint; authors can override it with an "Endpoint" row.
const WPT_DEFAULT_ENDPOINT = 'https://beta.asianpaints.com/apcolourcatalogue/wallPaintTool.wallPaintRecomendation.json';

// TEMP QA fallback: used only if the live fetch fails (e.g. the API is not yet
// CORS-enabled for this origin) so Step 3 can be visually QA'd. Remove once the
// endpoint responds with the proper Access-Control-Allow-Origin header.
const WPT_SAMPLE_DATA = {
  Luxury: {
    productTwo: {
      visibleTags: ['Unmatched Stain Resistance', 'Teflon Surface Protector', '8 Years Warranty'],
      entityName: 'Royale Luxury Emulsion',
      packShot: '/content/dam/asian_paints/products/packshots/interior-walls-royale-luxury-emulsion-asian-paints.png',
      sku: '0030',
      pagePath: '/content/ap/en/home/paint-products/interior-wall-paints/plain-finishes/royale-luxury-emulsion.html',
      productPrice: '5.07',
    },
    productOne: {
      visibleTags: ['Water Beading Technology', 'Luxury with Teflon™', '8 Years Warranty'],
      entityName: 'Royale Aspira',
      packShot: '/content/dam/asian_paints/products/packshots/interior-walls-royale-aspira-luxury-emulsion-asian-paints.png',
      sku: '1058',
      pagePath: '/content/ap/en/home/paint-products/interior-wall-paints/plain-finishes/royale-aspira.html',
      productPrice: '8.42',
    },
    wfProduct: {
      visibleTags: ['5 years Warranty', 'Ready to use', 'Anti-dampness and efflorescence'],
      entityName: 'SmartCare Hydroloc Xtreme',
      packShot: '/content/dam/asian_paints/products/packshots/Smartcare-Hydfroloc-Xtreme.png',
      sku: '1B72',
      pagePath: '/content/ap/en/home/waterproofing-products/hydroloc-xtreme.html',
    },
  },
  Premium: {
    productOne: {
      visibleTags: ['Stain Guard', 'High washability', '6 Years Warranty'],
      entityName: 'Apcolite Premium Satin Emulsion',
      packShot: '/content/dam/asian_paints/products/packshots/interior-walls-apcolite-premium-satin-emulsion-asian-paints.png',
      sku: '0074',
      pagePath: '/content/ap/en/home/paint-products/interior-wall-paints/plain-finishes/apcolite-premium-satin-emulsion.html',
      productPrice: '3.37',
    },
  },
};

// Parse the authored Step 3 rows into a config object. Each row is a
// key | value pair (the key is in the first cell) so authors can label
// exactly what each piece of copy is. List values (Inputs, Tabs) use a
// bullet list in the second cell.
function parseStep3Config(rows) {
  const cfg = {
    restart: 'Restart',
    title: '',
    subtitle: '',
    inputs: [], // labels for the 3 answers, e.g. ["Area", "Seepage", "Finish"]
    downloadText: '', // may contain a {tab} placeholder
    downloadCta: 'Download PDF',
    productsTitle: 'Recommended Products',
    tabs: [], // authored tab labels, matched against API response keys
    endpoint: WPT_DEFAULT_ENDPOINT,
    // static card sub-labels (UI chrome, sensible defaults)
    keyFeatures: 'Key Features',
    priceLabel: 'Price (per sqft)',
    viewDetails: 'View product details',
    wfLabel: 'Waterproofing Product',
    viewProduct: 'View product',
    // PDF copy; anything not authored falls back to PDF_DEFAULTS
    pdf: {},
  };

  (rows || []).forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const key = slug(cells[0].textContent);
    const valueCell = cells[1];
    const list = [...valueCell.querySelectorAll('li')].map((li) => li.textContent.trim());
    const text = valueCell.textContent.trim();
    const rich = (valueCell.querySelector('p') || valueCell).innerHTML;
    switch (key) {
      case 'restart': cfg.restart = text; break;
      case 'title': cfg.title = rich; break;
      case 'subtitle': cfg.subtitle = text; break;
      case 'inputs': cfg.inputs = list; break;
      case 'download-text': cfg.downloadText = rich; break;
      case 'download-cta': cfg.downloadCta = text; break;
      case 'products-title': cfg.productsTitle = text; break;
      case 'tabs': cfg.tabs = list; break;
      case 'endpoint': case 'api': cfg.endpoint = text; break;
      case 'pdf-file-name': cfg.pdf.fileName = text; break;
      case 'pdf-logo': cfg.pdf.logo = valueCell.querySelector('img')?.src || text; break;
      case 'pdf-header-description': cfg.pdf.headerDescription = valueCell.innerHTML.trim(); break;
      case 'pdf-disclaimer': cfg.pdf.disclaimer = text; break;
      case 'pdf-footer': cfg.pdf.footerDescription = rich; break;
      default: break;
    }
  });
  return cfg;
}

// Build one product card from an API product entry, appending the shared
// waterproofing product (wfProduct) in the footer.
function buildProductCard(product, wfProduct, cfg) {
  const card = document.createElement('article');
  card.className = 'wallpainttool-product';

  const head = document.createElement('div');
  head.className = 'wallpainttool-product-head';
  if (product.packShot) {
    const img = document.createElement('img');
    img.src = WPT_ASSET_BASE + product.packShot;
    img.alt = product.entityName || '';
    img.loading = 'lazy';
    head.append(img);
  }
  const name = document.createElement('strong');
  name.className = 'wallpainttool-product-name';
  name.textContent = product.entityName || '';
  head.append(name);
  card.append(head);

  // key features
  const kf = document.createElement('p');
  kf.className = 'wallpainttool-product-sublabel';
  kf.textContent = cfg.keyFeatures;
  card.append(kf);
  const tags = document.createElement('ul');
  tags.className = 'wallpainttool-product-tags';
  (product.visibleTags || []).forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    tags.append(li);
  });
  card.append(tags);

  // price (only when the API provides one)
  if (product.productPrice) {
    const priceLabel = document.createElement('p');
    priceLabel.className = 'wallpainttool-product-sublabel';
    priceLabel.textContent = cfg.priceLabel;
    card.append(priceLabel);
    const price = document.createElement('p');
    price.className = 'wallpainttool-product-price';
    price.textContent = `Rs.${product.productPrice}`;
    card.append(price);
  }

  // view details link
  if (product.pagePath) {
    const link = document.createElement('a');
    link.className = 'wallpainttool-product-link';
    link.href = WPT_ASSET_BASE + product.pagePath;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = cfg.viewDetails;
    card.append(link);
  }

  // shared waterproofing product footer
  if (wfProduct) {
    card.append(document.createElement('hr'));
    const wfLabel = document.createElement('p');
    wfLabel.className = 'wallpainttool-product-sublabel';
    wfLabel.textContent = cfg.wfLabel;
    card.append(wfLabel);

    const wf = document.createElement('div');
    wf.className = 'wallpainttool-wf';
    if (wfProduct.packShot) {
      const wfImg = document.createElement('img');
      wfImg.src = WPT_ASSET_BASE + wfProduct.packShot;
      wfImg.alt = wfProduct.entityName || '';
      wfImg.loading = 'lazy';
      wf.append(wfImg);
    }
    const wfBody = document.createElement('div');
    const wfName = document.createElement('strong');
    wfName.textContent = wfProduct.entityName || '';
    wfBody.append(wfName);
    if (wfProduct.pagePath) {
      const wfLink = document.createElement('a');
      wfLink.className = 'wallpainttool-product-link';
      wfLink.href = WPT_ASSET_BASE + wfProduct.pagePath;
      wfLink.target = '_blank';
      wfLink.rel = 'noopener';
      wfLink.textContent = cfg.viewProduct;
      wfBody.append(wfLink);
    }
    wf.append(wfBody);
    card.append(wf);
  }

  return card;
}

function buildStep3(rows) {
  const cfg = parseStep3Config(rows);

  const screen = document.createElement('div');
  screen.className = 'wallpainttool-screen wallpainttool-screen-3';
  screen.dataset.step = '3';

  // ---- LEFT column ----
  const left = document.createElement('div');
  left.className = 'wallpainttool-result-left';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'wallpainttool-restart';
  restartBtn.innerHTML = `<span class="wallpainttool-restart-icon" aria-hidden="true"></span><span>${cfg.restart}</span>`;

  const title = document.createElement('h2');
  title.className = 'wallpainttool-result-title';
  title.innerHTML = cfg.title;

  const subtitle = document.createElement('p');
  subtitle.className = 'wallpainttool-result-subtitle';
  subtitle.textContent = cfg.subtitle;

  const inputsEl = document.createElement('ul');
  inputsEl.className = 'wallpainttool-inputs';

  const download = document.createElement('div');
  download.className = 'wallpainttool-download';
  const downloadText = document.createElement('p');
  downloadText.className = 'wallpainttool-download-text';
  const downloadCta = document.createElement('button');
  downloadCta.type = 'button';
  downloadCta.className = 'wallpainttool-proceed wallpainttool-download-cta';
  downloadCta.innerHTML = `<span>${cfg.downloadCta}</span>`;
  download.append(downloadText, downloadCta);

  left.append(restartBtn, title, subtitle, inputsEl, download);

  // ---- RIGHT column ----
  const right = document.createElement('div');
  right.className = 'wallpainttool-result-right';

  const tabsEl = document.createElement('div');
  tabsEl.className = 'wallpainttool-tabs';
  tabsEl.setAttribute('role', 'tablist');

  const productsTitle = document.createElement('h3');
  productsTitle.className = 'wallpainttool-products-title';
  productsTitle.textContent = cfg.productsTitle;

  const productsEl = document.createElement('div');
  productsEl.className = 'wallpainttool-products';

  right.append(tabsEl, productsTitle, productsEl);

  const result = document.createElement('div');
  result.className = 'wallpainttool-result';
  result.append(left, right);
  screen.append(result);

  // render the download-text with the active tab substituted for {tab}
  function renderDownloadText(tabLabel) {
    const html = (cfg.downloadText || '').replace(
      /\{tab\}/gi,
      `<span class="wallpainttool-download-tab">${(tabLabel || '').toUpperCase()}</span>`,
    );
    downloadText.innerHTML = html;
  }

  // rank the API's word-numbered product keys (productOne, productTwo, ...)
  // in natural order — a plain string sort would place "Three" before "Two".
  const WPT_ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const productRank = (key) => {
    const word = key.toLowerCase().replace(/^product/, '');
    const idx = WPT_ORDINALS.indexOf(word);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  // render the product cards for the given tab key from the API data
  function renderProducts(data, tabKey) {
    productsEl.textContent = '';
    const group = data[tabKey] || {};
    const wfProduct = group.wfProduct || null;
    // main products are every entry except the shared waterproofing product,
    // ordered productOne, productTwo, productThree, ...
    Object.keys(group)
      .filter((k) => k !== 'wfProduct')
      .sort((a, b) => productRank(a) - productRank(b))
      .forEach((k) => productsEl.append(buildProductCard(group[k], wfProduct, cfg)));
  }

  // populate the left-column input summary from the selected answers,
  // pairing each authored label with the corresponding answer.
  function renderInputs(answers) {
    inputsEl.textContent = '';
    cfg.inputs.forEach((label, i) => {
      const li = document.createElement('li');
      li.innerHTML = `${label} - <strong>${answers[i] || ''}</strong>`;
      inputsEl.append(li);
    });
  }

  // the range on screen, for the PDF
  let selection = null;

  // build the tab buttons for whichever authored tabs exist in the response,
  // wire selection, and render the first available tab.
  function renderTabs(data, answers) {
    tabsEl.textContent = '';
    const available = cfg.tabs.filter((label) => Object.keys(data)
      .some((k) => k.toLowerCase() === label.toLowerCase()));
    const tabKeyFor = (label) => Object.keys(data)
      .find((k) => k.toLowerCase() === label.toLowerCase());

    const select = (label) => {
      [...tabsEl.children].forEach((b) => b.classList.toggle('is-active', b.dataset.tab === label));
      renderProducts(data, tabKeyFor(label));
      renderDownloadText(label);
      selection = { group: data[tabKeyFor(label)] || {}, label, answers };
    };

    available.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wallpainttool-tab';
      btn.dataset.tab = label;
      btn.textContent = label;
      btn.addEventListener('click', () => select(label));
      tabsEl.append(btn);
    });

    renderInputs(answers);
    if (available.length) select(available[0]);
  }

  return {
    screen, restartBtn, render: renderTabs, downloadCta, getSelection: () => selection,
  };
}

// ---------- Download PDF ----------
// As on the source (asianpaints.com paint-finish-tool): the recommendations
// for the tab on screen are laid out off screen with the PDF template below,
// drawn with html2canvas and split over A4 pages with jsPDF. Both libraries
// are loaded on the first click only.

const PDF_PAGE_WIDTH = 595; // A4 in pt
const PDF_PAGE_HEIGHT = 842;
// px width the template's spacing is designed for (the source's 740px sheet)
const PDF_RENDER_WIDTH = 740;

// Per range (tab) banner copy, image and colours, as the source's defaults.
const PDF_RANGES = {
  luxury: {
    heading: 'Luxury Paint Products',
    text: 'Best in class paint product recommendations for your space.',
    image: '/content/dam/asian_paints/testing/paint-tool/luxury-heading-bg.png',
    background: '#fcedd67f',
    featuresClass: 'text-luxury',
  },
  premium: {
    heading: 'Premium Paint Products',
    text: 'Superior quality paint product recommendations for your space',
    image: '/content/dam/asian_paints/testing/paint-tool/premium-heading-bg.png',
    background: '#d9f0fe7f',
    featuresClass: 'text-premium',
  },
  economy: {
    heading: 'Economy Paint Products',
    text: 'Budget friendly paint product recommendations for your space',
    image: '/content/dam/asian_paints/testing/paint-tool/economy-heading-bg.png',
    background: '#e2f4cb7f',
    featuresClass: 'text-economy',
  },
};

// Copy shared by every PDF; the "PDF ..." rows in Step 3 override the
// authorable ones (see parseStep3Config).
const PDF_DEFAULTS = {
  fileName: 'paint_tool',
  logo: '',
  headerDescription: '<p>Here are the best recommended products for you. Please review and reach out to us, for any questions.</p>',
  emailLabel: 'Email',
  mobileLabel: 'Mobile no',
  disclaimer: 'Final price may vary according to condition of the wall and local labour rates.',
  serviceHeading: '/content/dam/asian_paints/testing/paint-tool/painting-services-by-ap-linear-gradient.png',
  serviceDescription: '<div class="service-heading-two">Home Painting often brings to mind thoughts of stress and hassle, but with Beautiful Home Painting Service, the experience is transformed into “Hassle-Free & Safe Home Painting.”</div><div class="we-offer-section"><div class="we-offer-heading">We offer:</div><ul><li>End-to-end painting service with expert supervision.</li><li>Personalised Colour Consultation.</li><li>Thorough post-painting cleanup and maintainence.</li></ul></div>',
  whyChooseUs: '/content/dam/asian_paints/testing/paint-tool/why-choose-us.png',
  footerDescription: 'For painting needs call on 1800-209-5678',
  infoIcon: '/etc.clientlibs/apcolourcatalogue/clientlibs/clientlib-global/resources/images/circle-info-grey.svg',
};

// The source's PDF template styles (every rule is scoped to the sheet).
// The sheet is drawn at a fixed 740px with no transform, so it lays out the
// same on every screen size.
const PDF_STYLES = `
.paint-tool-main-pdf { font-family: Manrope, sans-serif; }
      .paint-tool-main-pdf {
        height: auto;
        max-width: 740px;
        margin: 0px auto;
        transform: scale(1.5);
        padding: 0px 50px;
        background: #FFFFFF;
      }

      @media (min-width: 320px) and (max-width: 991px) {
      .paint-tool-main-pdf {
        width: 740px;
        transform: scale(1);
      }
    }

      .paint-tool-main-pdf .customer-name {
        color: #000;
        font-family: Manrope;
        font-size: 20px;
        font-style: normal;
        font-weight: 800;
        line-height: 27.32px;
        margin-bottom: 4px;
      }

      .paint-tool-main-pdf .paintToolPDF-description {
        margin-bottom: 20px;
        position: relative;
      }

      .paint-tool-main-pdf .contact-details {
        width: 59%;
        display: inline-block;
        text-align: right;
        margin-left: 210px;
        position: absolute;
        top: 0;
        right: 0;
      }

      .paint-tool-main-pdf div.paintToolPDF-detail p{
        color: #000;
        font-family: Manrope;
        font-size: 11px;
        font-style: normal;
        font-weight: 400;
        line-height: 15.03px;
        width: 48%;
        display: inline-block;
        opacity: 0.6;
        margin-bottom: 0;
      }

      .paint-tool-main-pdf p.contact-details-mobileno {
        color: #000;
        font-family: Manrope;
        font-size: 11px;
        font-style: normal;
        font-weight: 600;
        line-height: normal;
        text-align: end;
        margin-bottom: 0px;
      }

      .paint-tool-main-pdf p.contact-details-mobileno span {
        color: #000;
        font-family: Manrope;
        font-size: 11px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
        opacity: 0.6;
        margin-right: 4px;
        vertical-align: text-top;
      }

      .paint-tool-main-pdf p.contact-details-emailid {
        color: #000;
        font-family: Manrope;
        font-size: 11px;
        font-style: normal;
        font-weight: 600;
        line-height: normal;
        margin-bottom: 0;
      }

      .paint-tool-main-pdf p.contact-details-emailid span {
        color: #000;
        font-family: Manrope;
        font-size: 11px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
        opacity: 0.6;
        margin-right: 4px;
        margin-bottom: 0;
      }


      .paint-tool-main-pdf .paintToolPDF-header {
        display: flex;
        margin-bottom: 5px;
        justify-content: space-between;
        padding-top: 40px;
        align-items: center;
      }

    .paint-tool-main-pdf .paintToolPDF-header-logo {
        width: 153px;
        height: 28px;
    }

    .paint-tool-main-pdf .paint-product-container-hr {
      width: 100%;
      border-top: 1px solid black;
      opacity: .2;
      margin: 0 0 20px;
    }

    .paint-tool-main-pdf .recommended-product-container {
      width: 100%;
      height: auto;
    }

    .paint-tool-main-pdf .recommended-product-container .title-section {
      width: 100%;
      height: 100px;
      padding: 0 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      row-gap: 5px;
      background-image: var(--paint-heading-bg-url);
      background-repeat: no-repeat;
      background-size: 100% 100%;
    }

    .paint-tool-main-pdf .recommended-product-container .title-section .title-one {
      font-size: 22px;
      font-weight: 800;
      line-height: 29.32px;
      text-align: left;
      color: #FFFFFF;
    }

    .paint-tool-main-pdf .recommended-product-container .title-section .title-two {
      font-size: 12px;
      font-weight: 400;
      line-height: 18px;
      text-align: left;
      letter-spacing: -0.011em;
      color: #FFFFFF;
    }

    .paint-tool-main-pdf .recommended-product-container .recommended-product-section {
      position: relative;
      width: 100%;
      height: auto;
      border-bottom: 1px solid #00000019;
      border-left: 1px solid #00000019;
      border-right: 1px solid #00000019;
    }

    .paint-tool-main-pdf .recommended-product-container .recommended-product-section.luxury-bg {
      background: #fcedd67f;
    }

    .paint-tool-main-pdf .recommended-product-container .recommended-product-section.premium-bg {
      background: #d9f0fe7f;
    }

    .paint-tool-main-pdf .recommended-product-container .recommended-product-section.economy-bg {
      background: #e2f4cb7f;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section {
      display: flex;
      padding: 20px 30px;
      column-gap: 15px;
      height: 228px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section.water-proofing-product-image-description-section {
      background: linear-gradient(91.16deg, #431a8019 1.46%, #ee413719 51.38%, #feb94019 100%);
      border-radius: 8px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-image-section {
      width: 24%;
      margin-top: 5px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-image-section img {
      width: 128px;
      height: auto;
      object-fit: contain;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section {
      width: 76%;
      display: flex;
      flex-direction: column;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-description-title-one {
      font-size: 18px;
      font-weight: 600;
      line-height: 23.86px;
      text-align: left;
      color: #000000;
      padding-top: 5px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-description-title-two {
      font-size: 13px;
      font-weight: 400;
      line-height: 17.03px;
      text-align: left;
      color: #000000;
      padding-top: 8px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section {
      display: flex;
      flex-direction: row;
      padding: 12px 0 10px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-section {
      width: 65%;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-price-section {
      width: 35%
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-heading, .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-price-heading {
      font-size: 14px;
      font-weight: 700;
      line-height: 16.4px;
      padding-bottom: 10px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-heading {
      text-align: left;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-price-heading {
      text-align: right;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .text-luxury {
      color: #A69075;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .text-premium {
      color: #425E8E;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .text-economy {
      color: #607755;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .text-waterproofing {
      color: #4D4D4D;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-section ul {
      margin-left: 20px;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-section ul li {
      list-style-type: disc;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-section ul li, .paint-tool-main-pdf .rec-description-section .rec-features-price-section .rec-price-section .rec-price-value {
      font-size: 13px;
      font-weight: 400;
      line-height: 17.03px;
      color: #000000;
    }

    .paint-tool-main-pdf .recommended-product-image-description-section .rec-description-section .rec-features-price-section .rec-features-section ul li {
      text-align: left;
    }

    .paint-tool-main-pdf .rec-description-section .rec-features-price-section .rec-price-section .rec-price-value {
      text-align: right;
    }

    .paint-tool-main-pdf .recommended-product-section .paint-product-hr {
      width: 90%;
      border-top: .6px solid black;
      opacity: .2;
      margin: 0 auto;
    }

    .paint-tool-main-pdf .price-warning-text {
      font-size: 10px;
      font-weight: 400;
      line-height: 13.66px;
      text-align: left;
      color: #4D4D4D;
      display: flex;
      column-gap: 2px;
      align-items: center;
      margin-top: 10px;
    }

    .paint-tool-main-pdf .price-warning-text img {
      width: 16px;
      height: 16px;
    }

    .paint-tool-main-pdf .water-proofing-product-container .water-proofing-heading {
      font-size: 18px;
      font-weight: 800;
      line-height: 23.86px;
      text-align: left;
      color: #2F2F2F;
      margin-bottom: 10px;
    }

    .paint-tool-main-pdf .services-by-ap-container {
      margin-bottom: 20px;
    }

    .paint-tool-main-pdf .services-by-ap-container .service-heading-one-image {
      width: auto;
      height: 22px;
      margin-bottom: 12px;
    }

    .paint-tool-main-pdf .services-by-ap-container .service-heading-two {
      font-size: 14px;
      font-weight: 500;
      line-height: 18.39px;
      text-align: left;
      color: #4D4D4D;
      margin-bottom: 20px;
    }

    .paint-tool-main-pdf .services-by-ap-container .we-offer-section {
      width: 100%;
    }

    .paint-tool-main-pdf .services-by-ap-container .we-offer-section .we-offer-heading {
      font-size: 14px;
      font-weight: 700;
      line-height: 16.4px;
      color: #4D4D4D;
      margin-bottom: 12px;
    }

    .paint-tool-main-pdf .services-by-ap-container .we-offer-section ul {
      margin-left: 20px;
    }

    .paint-tool-main-pdf .services-by-ap-container .we-offer-section ul li {
      font-size: 14px;
      font-weight: 500;
      line-height: 18.39px;
      color: #4D4D4D;
      list-style-type: disc;
    }

    .paint-tool-main-pdf .whychooseus-container {
      margin-bottom: 16px;
      padding: 0;
    }

    .paint-tool-main-pdf .whychooseus {
      width: 100%;
      height: auto;
    }
    
    .paint-tool-main-pdf .footer-description p {
      color: #00000099;
      text-align: center;
      width: 100%;
      font-size: 12px;
      font-weight: 400;
      line-height: 20px;
      margin: 0;
      padding: 0;
    }

    .paint-tool-main-pdf .footer-description span {
      padding: 5px;
      background-color: #00c85329;
      font-size: 12px;
      font-weight: 600;
      line-height: 28px;
      color: black;
      border-radius: 3px;
    }
#paintToolPDF.paint-tool-main-pdf {
  box-sizing: border-box;
  width: ${PDF_RENDER_WIDTH}px;
  max-width: none;
  margin: 0;
  transform: none;
}`;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Images drawn into the PDF must be readable cross-origin, or html2canvas
// leaves them out. The AEM asset host answers every request (cached or not)
// with "Access-Control-Allow-Origin: *"; www.asianpaints.com only does when
// asked, so a copy the page has already shown would taint the canvas.
const PDF_ASSET_BASE = 'https://static.asianpaints.com';

// site-relative asset paths ("/content/dam/...") are read from the asset host
const pdfAssetUrl = (path) => {
  if (!path || /^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path || '';
  return PDF_ASSET_BASE + path;
};

/**
 * The name, email and mobile number shown at the top of the PDF: the
 * CCFormFields cookie (name|email|mobile|pincode) set when the lead form is
 * sent, else whatever is typed in the Step 2 form.
 */
function readPdfUser(form) {
  const [name = '', email = '', mobile = ''] = (getCookieValues('CCFormFields') || '').split('|');
  const field = (selector) => form?.querySelector(selector)?.value.trim() || '';
  return {
    name: name || field(LEAD_SELECTORS.name),
    email: email || field(LEAD_SELECTORS.email),
    mobile: mobile || field(LEAD_SELECTORS.mobile),
  };
}

function pdfProductHtml(product, featuresClass, { showPrice = true, extraClass = '' } = {}) {
  const features = (product.visibleTags || []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');
  return `<div class="recommended-product-image-description-section ${extraClass}">
      <div class="rec-image-section">
        <img src="${escapeHtml(pdfAssetUrl(product.packShot))}" alt="" crossorigin="anonymous"/>
      </div>
      <div class="rec-description-section">
        <div class="rec-description-title-one">${escapeHtml(product.entityName)}</div>
        <div class="rec-description-title-two">${escapeHtml(product.description)}</div>
        <div class="rec-features-price-section">
          <div class="rec-features-section">
            <div class="rec-features-heading ${featuresClass}">Key Features</div>
            <ul>${features}</ul>
          </div>
          <div class="rec-price-section"${showPrice ? '' : ' style="display: none"'}>
            <div class="rec-price-heading ${featuresClass}">Price (per sqft)</div>
            <div class="rec-price-value">Rs.${escapeHtml(product.productPrice)}</div>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * The PDF sheet, as the source's template. The fixed margins push the
 * disclaimer, waterproofing product and footer onto the right A4 pages
 * for 1, 2 or 3 products, with or without seepage.
 */
function buildPdfHtml({
  group, label, withSeepage, user, pdf,
}) {
  const range = PDF_RANGES[label.toLowerCase()] || {
    ...PDF_RANGES.luxury, heading: `${label} Paint Products`,
  };
  // same order as the source's PDF
  const products = {
    productTwo: group.productTwo,
    productThree: group.productThree,
    productOne: group.productOne,
    wfProduct: group.wfProduct,
  };
  const validKeys = Object.keys(products).filter((k) => products[k]);
  const hasWf = validKeys.includes('wfProduct');

  let count = 0;
  let productsHtml = '';
  Object.keys(products).forEach((key) => {
    if (key === 'wfProduct' || !products[key]) return;
    count += 1;
    productsHtml += pdfProductHtml(products[key], range.featuresClass);
    const notLast = withSeepage && hasWf
      ? validKeys.length > 2 && validKeys.indexOf(key) !== validKeys.length - 2
      : validKeys.length > 1 && validKeys.indexOf(key) !== validKeys.length - 1;
    if (notLast) productsHtml += '<hr class="paint-product-hr">';
  });

  let warningMargin = '120px';
  if (count === 1) warningMargin = withSeepage && hasWf ? '30px' : '585px';
  else if (count === 2) warningMargin = '355px';

  const wfHtml = hasWf ? `<div class="water-proofing-product-container" style="margin-bottom: ${count === 1 ? '290px' : '20px'}">
      <div class="water-proofing-heading">Recommended Waterproofing Product</div>
      ${pdfProductHtml(products.wfProduct, 'text-waterproofing', { showPrice: false, extraClass: 'water-proofing-product-image-description-section' })}
    </div>` : '';

  const logo = pdf.logo ? `<img src="${escapeHtml(pdfAssetUrl(pdf.logo))}" class="paintToolPDF-header-logo" alt="" crossorigin="anonymous">` : '';

  return `<div class="paint-tool-main-pdf" id="paintToolPDF">
    <div class="paintToolPDF-header">
      <p class="customer-name">Dear ${escapeHtml(user.name)},</p>
      ${logo}
    </div>
    <div class="paintToolPDF-description">
      <div class="paintToolPDF-detail">${pdf.headerDescription}</div>
      <div class="contact-details">
        <p class="contact-details-mobileno"><span>${escapeHtml(pdf.mobileLabel)}:</span>${escapeHtml(user.mobile)}</p>
        <p class="contact-details-emailid"><span>${escapeHtml(pdf.emailLabel)}:</span>${escapeHtml(user.email)}</p>
      </div>
    </div>
    <hr class="paint-product-container-hr">
    <div class="recommended-product-container">
      <div class="title-section" style="--paint-heading-bg-url: url('${pdfAssetUrl(range.image)}')">
        <div class="title-one">${escapeHtml(range.heading)}</div>
        <div class="title-two">${escapeHtml(range.text)}</div>
      </div>
      <div style="background:${range.background}" class="recommended-product-section">${productsHtml}</div>
    </div>
    <div class="price-warning-text" style="margin-bottom: ${warningMargin}">
      <img src="${pdfAssetUrl(pdf.infoIcon)}" alt="" crossorigin="anonymous"/>
      ${escapeHtml(pdf.disclaimer)}
    </div>
    ${wfHtml}
    <div class="services-by-ap-container">
      <img class="service-heading-one-image" src="${pdfAssetUrl(pdf.serviceHeading)}" alt="" crossorigin="anonymous"/>
      ${pdf.serviceDescription}
    </div>
    <div class="whychooseus-container">
      <img class="whychooseus" src="${pdfAssetUrl(pdf.whyChooseUs)}" alt="" crossorigin="anonymous">
    </div>
    <div class="footer-description" style="margin-top: ${count > 1 && hasWf ? '80px' : '360px'}">
      ${pdf.footerDescription}
    </div>
  </div>`;
}

function loadPdfLibraries() {
  const base = `${window.hlx?.codeBasePath || ''}/scripts/vendor`;
  return Promise.all([
    window.jspdf || loadScript(`${base}/jspdf.umd.min.js`),
    window.html2canvas || loadScript(`${base}/html2canvas.min.js`),
  ]);
}

/**
 * Builds and downloads the PDF for one range of recommendations.
 * @param {object} options
 * @param {object} options.group the API entry for the range (productOne, ..., wfProduct)
 * @param {string} options.label the tab label, e.g. "Luxury"
 * @param {boolean} options.withSeepage whether "Yes" was picked for seepage
 * @param {{name: string, email: string, mobile: string}} options.user
 * @param {object} options.pdf PDF copy (PDF_DEFAULTS merged with the authored rows)
 */
async function downloadRecommendationsPdf(options) {
  await loadPdfLibraries();

  // off screen, outside the block so none of its styles apply
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position: absolute; top: 0; left: -10000px; width: ${PDF_RENDER_WIDTH}px; background: #fff;`;
  host.innerHTML = `<style>${PDF_STYLES}</style>${buildPdfHtml({ ...options, pdf: { ...PDF_DEFAULTS, ...options.pdf } })}`;
  document.body.append(host);

  try {
    const sheet = host.querySelector('#paintToolPDF');
    // every image must be loaded before the sheet is drawn
    await Promise.all([...sheet.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));

    const canvas = await window.html2canvas(sheet, {
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 2,
      width: PDF_RENDER_WIDTH,
      windowWidth: PDF_RENDER_WIDTH,
    });

    const { jsPDF: JsPdf } = window.jspdf;
    const doc = new JsPdf('p', 'pt', 'a4');
    const image = canvas.toDataURL('image/jpeg', 0.92);
    const imgHeight = (canvas.height * PDF_PAGE_WIDTH) / canvas.width;
    const { GState } = doc;
    const footer = () => {
      doc.setFontSize(10);
      doc.setGState(new GState({ opacity: 0.2 }));
      doc.setTextColor(128, 128, 128);
      doc.text('______________________________________________________________', 125, 790);
      doc.setGState(new GState({ opacity: 1 }));
    };

    // the sheet is one tall image: each page shows the next 842pt of it
    let heightLeft = imgHeight;
    doc.addImage(image, 'JPEG', 0, 0, PDF_PAGE_WIDTH, imgHeight);
    heightLeft -= PDF_PAGE_HEIGHT;
    while (heightLeft >= 0) {
      doc.addPage();
      doc.addImage(image, 'JPEG', 0, heightLeft - imgHeight, PDF_PAGE_WIDTH, imgHeight);
      heightLeft -= PDF_PAGE_HEIGHT;
      footer();
    }

    const fileName = options.pdf?.fileName || PDF_DEFAULTS.fileName;
    doc.save(/\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`);
  } finally {
    host.remove();
  }
}

/**
 * Shows or hides the button's loader, as the source: a "↻" after the arrow
 * that spins while the button works. The button is disabled meanwhile so it
 * can't be pressed twice.
 * @param {HTMLButtonElement} button
 * @param {boolean} loading
 */
function setButtonLoading(button, loading) {
  let loader = button.querySelector('.wallpainttool-loader');
  if (!loader) {
    loader = document.createElement('span');
    loader.className = 'wallpainttool-loader';
    loader.setAttribute('aria-hidden', 'true');
    loader.textContent = '↻';
    button.append(loader);
  }
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
  if (loading) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

export default function decorate(block) {
  const allRows = [...block.children];
  if (!allRows.length) return;

  // Background images are authored once (as the image row under Step 1) but
  // shared by every step, so they are read from the block and exposed as CSS
  // custom properties. First <img> = desktop, second = mobile; the "?"-strip
  // drops any DA rendition query so the source stays crisp.
  const imgs = [...block.querySelectorAll('img')];
  const desktopSrc = imgs[0] ? (imgs[0].currentSrc || imgs[0].src).split('?')[0] : '';
  const mobileSrc = imgs[1] ? (imgs[1].currentSrc || imgs[1].src).split('?')[0] : desktopSrc;

  // Build each step's DOM subtree from its authored rows.
  const steps = splitSteps(allRows);
  const step1 = buildStep1(steps[0] || []);
  const step2 = buildStep2(steps[1] || []);
  const step3 = buildStep3(steps[2] || []);
  const cfg = parseStep3Config(steps[2] || []);

  // Once the form has been completed at least once we skip Step 2 on
  // subsequent Proceeds (the "Restart" flow lets users tweak Step 1 answers
  // and jump straight back to the results).
  let formCompleted = false;

  // Read the three Step 1 answers (area, seepage, finish) in order.
  const step1Answers = () => [...step1.form.querySelectorAll('input[type="radio"]:checked')]
    .map((r) => r.value);

  // Fetch recommendations and show the results screen.
  async function showResults() {
    const [area, seepage, finish] = step1Answers();
    const params = new URLSearchParams({ area, seepage, finish });
    const url = `${cfg.endpoint}?${params.toString()}`;
    block.dataset.loading = 'true';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      step3.render(data, [area, seepage, finish]);
      block.dataset.screen = '3';
    } catch (err) {
      // TEMP QA: the live API isn't reachable from the browser yet (CORS), so
      // fall back to sample data to let Step 3 be QA'd. Remove WPT_SAMPLE_DATA
      // and this fallback once the endpoint is CORS-enabled.
      // eslint-disable-next-line no-console
      console.warn('wallpainttool recommendation request failed; using sample data', err);
      step3.render(WPT_SAMPLE_DATA, [area, seepage, finish]);
      block.dataset.screen = '3';
    } finally {
      block.dataset.loading = 'false';
    }
  }

  // Navigation is driven by a single `data-screen` attribute on the block;
  // the CSS shows only the matching step and hides the rest. All three steps
  // stay in the DOM so form state is preserved when moving between them.
  step1.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step1.proceed.disabled) return; // guard: questions not all answered
    // Skip Step 2 when authored to (Skip Form = true) or once the lead form
    // has already been completed; otherwise show the lead form.
    if (step2.skipForm || formCompleted) {
      showResults();
    } else {
      // prefill from the CCFormFields cookie now (not at decorate) so details
      // saved by another form on this page since load are picked up too
      if (step2.form) checkCookieValues(step2.form, LEAD_SELECTORS);
      block.dataset.screen = '2';
    }
  });

  if (step2.form) {
    step2.form.addEventListener('submit', (e) => {
      e.preventDefault();
      // validate every field (not just the first failure) so all errors show
      const inputs = [...step2.form.querySelectorAll('.wallpainttool-field input')];
      const questions = [...step2.form.querySelectorAll('.wallpainttool-form2-questions fieldset')];
      const results = [
        ...inputs.map((input) => validateInputField(input)),
        ...questions.map((fieldset) => validateQuestion(fieldset)),
      ];
      if (results.includes(false)) return;
      if (step2.form.dataset.submitting === 'true') return;

      // Send the lead exactly as form.js does for a BHPS form; the radio
      // answers are picked up by name (BHPS_QUESTION_NAMES).
      step2.form.dataset.submitting = 'true';
      // the loader stays until the recommendations are on screen
      setButtonLoading(step2.submit, true);
      step2.submitError.hidden = true;
      submitLeadFromForm(step2.form, {
        resourcePath: step2.node || window.location.pathname,
        campaignId: step2.campaignId,
        endpoints: LEAD_ENDPOINTS,
        selectors: {
          ...LEAD_SELECTORS,
          whatsappConsent: 'input[name="whatsapp-optin"]',
        },
      })
        .then(() => {
          setFormFieldsToCookie(step2.form, LEAD_SELECTORS);
          formCompleted = true;
          return showResults();
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('wallpainttool lead submission failed', err);
          step2.submitError.hidden = false;
        })
        .finally(() => {
          step2.form.dataset.submitting = 'false';
          setButtonLoading(step2.submit, false);
        });
    });
  }

  // Restart returns to Step 1 with the previous answers preserved so the
  // user can adjust them; the lead form is skipped on the next Proceed.
  if (step3.restartBtn) {
    step3.restartBtn.addEventListener('click', () => {
      block.dataset.screen = '1';
    });
  }

  // Download PDF: the recommendations for the tab on screen, with the
  // details from the lead form. The loader spins while it builds.
  step3.downloadCta.addEventListener('click', async () => {
    const selection = step3.getSelection();
    if (!selection || step3.downloadCta.disabled) return;
    setButtonLoading(step3.downloadCta, true);
    try {
      await downloadRecommendationsPdf({
        group: selection.group,
        label: selection.label,
        withSeepage: /^yes$/i.test(selection.answers[1] || ''),
        user: readPdfUser(step2.form),
        pdf: {
          ...cfg.pdf,
          // the site logo unless one is authored
          logo: cfg.pdf.logo || document.querySelector('header img')?.src || '',
        },
      });
      trackPdfDownload(step3.downloadCta);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('wallpainttool PDF download failed', err);
    } finally {
      setButtonLoading(step3.downloadCta, false);
    }
  });

  // Replace the authored table with the assembled steps and start on step 1.
  block.textContent = '';
  if (desktopSrc) block.style.setProperty('--wpt-bg-desktop', `url("${desktopSrc}")`);
  if (mobileSrc) block.style.setProperty('--wpt-bg-mobile', `url("${mobileSrc}")`);
  block.dataset.screen = '1';
  block.append(step1.screen, step2.screen, step3.screen);
}
