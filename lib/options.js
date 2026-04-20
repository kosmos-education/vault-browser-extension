/* global browser */
/**
 * Options page controller.
 *
 * Handles authentication, backend selection, auto-search toggle and the
 * version banner. State lives in lib/vault.js and browser.storage.local,
 * so this file is pure DOM plumbing.
 */

import Vault from './vault.js';
import Notify from './notify.js';
import { HIDDEN_BACKENDS, StorageKeys } from './constants.js';
import * as storage from './storage.js';
import { applyI18n } from './i18n.js';

const notify = new Notify(document.querySelector('#notify'));

document.addEventListener('DOMContentLoaded', mainLoaded, false);

async function mainLoaded() {
  applyI18n();
  wireFixedListeners();
  renderVersion();

  await Vault.load();
  await hydrateForm();
  await renderAuthState();
}

function wireFixedListeners() {
  document.getElementById('authButton').addEventListener('click', handleAuthClick, false);
  document.getElementById('login').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleAuthClick();
  }, false);
  document.getElementById('logoutButton').addEventListener('click', handleLogout, false);
  document.getElementById('autoSearch').addEventListener('change', (e) => {
    storage.set(StorageKeys.AUTO_SEARCH, e.target.checked);
  });
}

/** Stamp the extension version on every `.version` element. */
function renderVersion() {
  const version = browser.runtime.getManifest().version;
  for (const el of document.getElementsByClassName('version')) {
    el.textContent = `Version: ${version}`;
  }
}

/** Populate form inputs from persisted state (URL, username, auto-search). */
async function hydrateForm() {
  const vaultServer = document.getElementById('serverBox');
  const loginBox = document.getElementById('loginBox');
  const autoSearch = document.getElementById('autoSearch');

  if (Vault.address) {
    vaultServer.value = Vault.address;
    vaultServer.parentNode.classList.add('is-dirty');
  }

  const username = await storage.get(StorageKeys.USERNAME);
  if (username) {
    loginBox.value = username;
    loginBox.parentNode.classList.add('is-dirty');
  }

  autoSearch.checked = Boolean(await storage.get(StorageKeys.AUTO_SEARCH));
}

/** Show the login or logout panel based on the current token. */
async function renderAuthState() {
  const loggedIn = await Vault.isLoggedIn();
  document.getElementById('login').style.display = loggedIn ? 'none' : 'block';
  document.getElementById('logout').style.display = loggedIn ? 'block' : 'none';
  if (loggedIn) await refreshUserBackends();
}

async function handleAuthClick() {
  const vaultServer = document.getElementById('serverBox');
  const loginBox = document.getElementById('loginBox');
  const pass = document.getElementById('passBox');
  const authMount = document.querySelector('input[name="auth_mount"]:checked').value;

  if (!vaultServer.value || !loginBox.value || !pass.value) {
    notify.error(chrome.i18n.getMessage('fill_all_fields'));
    return;
  }

  await storage.set(StorageKeys.USERNAME, loginBox.value);
  try {
    await Vault.setAddress(vaultServer.value);
    await Vault.login(authMount, { username: loginBox.value, password: pass.value });
  } catch (e) {
    notify.clear().error(chrome.i18n.getMessage('login_failure') + ` ${e.message}`);
    await Vault.logout();
  }
  await renderAuthState();
}

async function handleLogout() {
  await Vault.logout();
  notify.clear().success(chrome.i18n.getMessage('logged_out'), {
    time: 1000,
    removeOption: false,
  });
  document.getElementById('login').style.display = 'block';
  document.getElementById('logout').style.display = 'none';
}

/**
 * Fetch the list of mounts the user is allowed to see, then rebuild the
 * checkbox list.
 */
async function refreshUserBackends() {
  notify.clear();
  let backends;
  try {
    const response = await Vault.get('/sys/internal/ui/mounts');
    backends = response.data.secret;
  } catch (e) {
    notify.error(chrome.i18n.getMessage('getting_backends_failure') + `: ${e.message}`);
    return;
  }
  await renderBackendList(backends);
}

async function renderBackendList(backends) {
  const parent = document.getElementById('backendsList');
  parent.textContent = '';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = chrome.i18n.getMessage('backends_list');
  parent.appendChild(label);

  const saved = await storage.get(StorageKeys.CURRENT_BACKENDS);
  const savedBackends = Array.isArray(saved) ? saved : [];

  const list = document.createElement('ul');
  list.className = 'responsive-table';

  for (const key of Object.keys(backends)) {
    const backendName = key.replace('/', '');
    if (HIDDEN_BACKENDS.includes(backendName)) continue;

    list.appendChild(buildBackendRow(backendName, savedBackends.includes(backendName)));
  }

  list.addEventListener('change', persistCheckedBackends);
  parent.appendChild(list);
}

function buildBackendRow(backendName, checked) {
  const row = document.createElement('li');
  row.className = 'table-row';

  const rowLabel = document.createElement('div');
  rowLabel.classList.add('col', 'col-1');
  rowLabel.textContent = backendName === 'private'
    ? chrome.i18n.getMessage('private_directory')
    : backendName;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = backendName;
  checkbox.name = 'backend';
  checkbox.id = backendName;
  checkbox.classList.add('col', 'col-2', 'backendCheckbox');
  checkbox.checked = checked;

  row.append(rowLabel, checkbox);
  return row;
}

function persistCheckedBackends() {
  const selected = Array.from(
    document.querySelectorAll('input[name="backend"]:checked'),
  ).map((box) => box.value);
  storage.set(StorageKeys.CURRENT_BACKENDS, selected);
}
