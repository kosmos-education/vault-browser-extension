/* global browser */
/**
 * Thin wrapper over browser.storage.local.
 *
 * - get(key)          -> value or undefined (instead of { key: value })
 * - getMany([k1, k2]) -> { k1, k2 } object
 * - set(key, value)   -> Promise<void>
 * - setMany({...})    -> Promise<void>
 * - remove(key|keys)  -> Promise<void>
 * - clear()           -> Promise<void>
 */

/**
 * Retrieve a single value.
 * @param {string} key
 * @returns {Promise<*>} the stored value, or undefined when absent.
 */
export async function get(key) {
  const result = await browser.storage.local.get(key);
  return result[key];
}

/**
 * Retrieve several values at once.
 * @param {string[]} keys
 * @returns {Promise<Object>}
 */
export async function getMany(keys) {
  return browser.storage.local.get(keys);
}

/**
 * Store a single value.
 * @param {string} key
 * @param {*} value
 */
export async function set(key, value) {
  await browser.storage.local.set({ [key]: value });
}

/**
 * Store several values at once.
 * @param {Object} entries
 */
export async function setMany(entries) {
  await browser.storage.local.set(entries);
}

/**
 * Remove one or several keys.
 * @param {string|string[]} keys
 */
export async function remove(keys) {
  await browser.storage.local.remove(keys);
}

/** Clear the whole local storage area. */
export async function clear() {
  await browser.storage.local.clear();
}
