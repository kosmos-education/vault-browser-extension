/**
 * Thin wrappers around browser.runtime messaging.
 *
 * Using these helpers (instead of calling chrome.runtime directly) guarantees
 * that every message shares the same `{ message, ...payload }` shape, and that
 * the action name comes from `MessageTypes` – which prevents typos between the
 * sender and the receiver.
 */

import { MessageTypes } from './constants.js';

/**
 * Send a runtime message.
 *
 * @param {string} type    One of `MessageTypes.*`.
 * @param {object} [payload]  Extra data merged into the message envelope.
 * @returns {Promise<any>} Whatever the receiver replies, if anything.
 */
export function sendMessage(type, payload = {}) {
  return browser.runtime.sendMessage({ message: type, ...payload });
}

/**
 * Register a handler for a single message type.
 *
 * The handler receives the full message object and the sender. If it returns
 * a Promise, the reply is awaited and sent back to the caller automatically.
 *
 * @param {string} type
 * @param {(message: object, sender: browser.runtime.MessageSender) => any} handler
 * @returns {() => void} A function that removes the listener.
 */
export function onMessage(type, handler) {
  const listener = (message, sender, sendResponse) => {
    if (!message || message.message !== type) return undefined;
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse, (err) => {
        console.error(`[messages] handler for "${type}" failed`, err);
        sendResponse({ error: err?.message ?? String(err) });
      });
      return true; // keep the channel open for the async reply
    }
    if (result !== undefined) sendResponse(result);
    return undefined;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

/**
 * Register several handlers at once.
 *
 * @param {Record<string, Function>} handlers  Keys are `MessageTypes.*` values.
 * @returns {() => void} A function that removes all listeners.
 */
export function onMessages(handlers) {
  const disposers = Object.entries(handlers).map(([type, fn]) => onMessage(type, fn));
  return () => disposers.forEach((dispose) => dispose());
}

// Re-export the enum so consumers only need to import from this module.
export { MessageTypes };
