/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* global browser chrome */

if (!browser.browserAction) {
  browser.browserAction = chrome.browserAction ?? chrome.action;
}
