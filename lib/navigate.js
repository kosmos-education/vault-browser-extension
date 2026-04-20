/**
 * Entry point for the popup page.
 *
 * Loads page state, wires header buttons, the search input and the
 * "add secret" dialog. All heavy lifting lives in lib/navigate/*.
 */

import Vault from './vault.js';
import { StorageKeys } from './constants.js';
import * as storage from './storage.js';
import { applyI18n } from './i18n.js';
import { openCreateSecretDialog, isCancelled } from './dialog-form.js';
import { notify } from './navigate/shared.js';
import { refreshExplorer } from './navigate/explorer.js';
import { putSecret } from './navigate/secrets.js';
import { searchSecrets } from './navigate/search.js';
import { initKeyboardNav } from './navigate/keyboard.js';
import { initLoader } from './loader.js';

document.addEventListener('DOMContentLoaded', mainLoaded, false);

async function mainLoaded() {
  applyI18n();
  initLoader();
  notify.clear();
  await Vault.load();

  if (!(await Vault.isLoggedIn())) {
    document.getElementById('result').style.display = 'none';
    notify.clear().info(chrome.i18n.getMessage('please_connect'), { removeOption: false });
    return;
  }

  await refreshExplorer();
  await maybeAutoSearch();

  document.getElementById('add-secret').addEventListener('click', onAddSecretClick);
  const searchInput = document.getElementById('vault-search');
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keyup', onSearchKeyup);
  initKeyboardNav();
}

/**
 * When auto-search is enabled and the current tab's domain is new, kick off
 * a search using the main domain fragment. This is best-effort — if anything
 * goes wrong, we fall back to the standard explorer.
 */
async function maybeAutoSearch() {
  const autoSearch = await storage.get(StorageKeys.AUTO_SEARCH);
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const searchInput = document.getElementById('vault-search');

  if (!autoSearch || !currentTab?.url) {
    searchInput.value = (await storage.get(StorageKeys.INPUT_VALUE)) || '';
    return;
  }

  const domain = new URL(currentTab.url).hostname;
  const cachedDomain = await storage.get(StorageKeys.DOMAIN);
  if (cachedDomain === domain) {
    searchInput.value = (await storage.get(StorageKeys.INPUT_VALUE)) || '';
    return;
  }

  try {
    const parts = domain.split('.');
    const mainDomain = parts[0] === 'www' ? parts[1] : parts[0];
    const found = await searchSecrets(mainDomain);
    await storage.set(StorageKeys.DOMAIN, domain);
    if (found) {
      notify.info(chrome.i18n.getMessage('secret_found') + mainDomain, { removeOption: true });
    } else {
      await refreshExplorer();
      notify.info(chrome.i18n.getMessage('secret_notfound') + mainDomain, { removeOption: true });
    }
  } catch {
    // Auto-search is best-effort; errors are silently ignored.
  }
}

async function onAddSecretClick() {
  try {
    const data = await openCreateSecretDialog();
    const ok = await putSecret(data);
    if (ok) await refreshExplorer();
  } catch (e) {
    if (isCancelled(e)) return;
    notify.error(e.message);
  }
}

function onSearchInput(event) {
  storage.set(StorageKeys.INPUT_VALUE, event.currentTarget.value);
}

async function onSearchKeyup(event) {
  if (event.key !== 'Enter') return;
  const found = await searchSecrets(event.currentTarget.value);
  if (!found) {
    notify.info(chrome.i18n.getMessage('search_result_empty'), { removeOption: true });
  }
}
