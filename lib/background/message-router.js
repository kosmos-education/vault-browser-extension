/* eslint-disable no-console */
/* global chrome */

/**
 * Service-worker message router.
 *
 * Centralises all `chrome.runtime.onMessage` handlers so background.js stays
 * short and the routing logic lives in a single place.
 */

import { MessageTypes } from '../constants.js';
import { copyStringToPageClipboard } from '../content/clipboard.js';
import { fillCredentialsInPage } from '../content/form-filler.js';
import { refreshTokenTimer } from './token-renewal.js';

/** Return the id of the currently active tab, or null. */
async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? tab.id : null;
}

/**
 * Inject a self-contained function into the active tab via chrome.scripting.
 * Silently no-ops when there's no active tab.
 */
async function injectIntoActiveTab(func, args) {
  const tabId = await getActiveTabId();
  if (tabId == null) return;
  await chrome.scripting.executeScript({ target: { tabId }, func, args });
}

/**
 * Register the single onMessage listener used by the background script.
 *
 * Notifications cannot be shown from the service worker (no DOM); we log
 * instead and rely on page-side callers to notify the user themselves.
 */
export function setupMessageRouter() {
  chrome.runtime.onMessage.addListener((request) => {
    if (!request || typeof request !== 'object') return;
    switch (request.message) {
      case MessageTypes.COPY_TO_CLIPBOARD:
        injectIntoActiveTab(copyStringToPageClipboard, [request]);
        break;
      case MessageTypes.FILL_CREDS:
        injectIntoActiveTab(fillCredentialsInPage, [request]);
        break;
      case MessageTypes.TOKEN_MISSING:
        console.warn('[vault] token missing');
        break;
      case MessageTypes.AUTO_RENEW_TOKEN:
        refreshTokenTimer();
        break;
    }
  });
}
