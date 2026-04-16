/**
 * Internationalisation helpers built on top of browser.i18n.
 *
 * Goals:
 *   - Keep a single short alias (`t`) for lookups instead of the very long
 *     `chrome.i18n.getMessage(...)` expression sprinkled across the codebase.
 *   - Provide a declarative way to translate the DOM via `data-i18n` attributes
 *     so that HTML templates no longer need a companion `i18n/page-*.js` file.
 *
 * Supported attributes on any element:
 *   data-i18n           -> replaces textContent with t(value)
 *   data-i18n-title     -> sets the `title` attribute
 *   data-i18n-placeholder -> sets the `placeholder` attribute
 *   data-i18n-aria-label  -> sets the `aria-label` attribute
 */

/**
 * Look up a localized message.
 *
 * @param {string} key          Message id as declared in `_locales/*`.
 * @param {string[]} [substitutions]  Optional positional substitutions.
 * @returns {string} The translated string, or the key itself when missing.
 */
export function t(key, substitutions) {
  const value = browser.i18n.getMessage(key, substitutions);
  return value || key;
}

const ATTRIBUTE_BINDINGS = [
  ['data-i18n-title', 'title'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-aria-label', 'aria-label'],
];

/**
 * Translate every element carrying a `data-i18n*` attribute inside `root`.
 *
 * @param {ParentNode} [root=document]
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });

  for (const [attr, target] of ATTRIBUTE_BINDINGS) {
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      el.setAttribute(target, t(el.getAttribute(attr)));
    });
  }
}
