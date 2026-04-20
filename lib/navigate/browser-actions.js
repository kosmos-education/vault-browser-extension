/**
 * Page-to-background bridge for the two tab-side actions the popup can
 * request: filling credentials into a login form, and copying a value to
 * the clipboard.
 *
 * Both are one-way `browser.runtime.sendMessage` calls routed by
 * lib/background/message-router.js.
 */

import { MessageTypes, sendMessage } from '../messages.js';
import { notify } from './shared.js';

export function fillCredentialsInBrowser(username, password) {
  notify.success(chrome.i18n.getMessage('copied_browser'), {
    time: 1000,
    removeOption: false,
  });
  return sendMessage(MessageTypes.FILL_CREDS, {
    username,
    password,
    isUserTriggered: true,
  });
}

export function copyStringToClipboard(string) {
  notify.success(chrome.i18n.getMessage('copied_clipboard'), {
    time: 1000,
    removeOption: false,
  });
  return sendMessage(MessageTypes.COPY_TO_CLIPBOARD, {
    string,
    isUserTriggered: true,
  });
}
