/*
 * Analytics helpers used by blocks (same API as the edspoc-stg project's analytics_1.js).
 * Events are pushed to the Google and Adobe client data layers; with no tag manager on
 * the page they are simply kept in the arrays.
 */

/**
 * Pushes a custom event to the Google data layer.
 * @param {string} event The event name
 * @param {Object} [data] Event properties
 */
export function trackEvent(event, data = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
}

/**
 * Pushes a CTA click to the Adobe client data layer.
 * @param {{ event?: string, cta?: string, parentTitle?: string }} [data] Click details
 */
export function pushAdobeCtaClickEvent({ event = 'cta_click', ...data } = {}) {
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({ event, eventInfo: data });
}
