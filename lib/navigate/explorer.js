/**
 * Explorer controller.
 *
 * Coordinates the list of items shown on the navigate page, the navigation
 * actions exposed through the header buttons, and the behavior behind every
 * row (fill, copy, edit, delete).
 */

import Vault from '../vault.js';
import { StorageKeys } from '../constants.js';
import * as storage from '../storage.js';
import { notify, resultList } from './shared.js';
import {
  getCurrentBackends,
  getCurrentPath,
  getItemName,
  getParentPath,
  loadState,
  setCurrentPath,
} from './state.js';
import { renderDirectory, renderSecret } from './items.js';
import {
  fetchSecretData,
  fetchSecretValue,
  deleteSecret,
  putSecret,
  isCancelled,
} from './secrets.js';
import { copyStringToClipboard, fillCredentialsInBrowser } from './browser-actions.js';
import { openEditSecretDialog, pickSecretKey } from '../dialog-form.js';

/**
 * Navigate into a directory. The "private/" pseudo-directory appends the
 * stored username so each user sees their own sub-tree.
 */
async function openDirectory(fullPathName, ignoreError = false) {
  let target = fullPathName;
  if (fullPathName === 'private/') {
    const username = await storage.get(StorageKeys.USERNAME);
    target = fullPathName + username + '/';
  }
  await setCurrentPath(target);
  await refreshExplorer(ignoreError);
}

async function handleCopy(fullPathName) {
  try {
    const value = await fetchSecretValue(fullPathName);
    copyStringToClipboard(value);
  } catch (e) {
    if (isCancelled(e)) return;
    notify.error(chrome.i18n.getMessage('getting_secret_failure') + `: ${e.message}`);
  }
}

async function handleFill(fullPathName) {
  try {
    const value = await fetchSecretValue(fullPathName);
    fillCredentialsInBrowser(getItemName(fullPathName), value);
  } catch (e) {
    if (isCancelled(e)) return;
    notify.error(chrome.i18n.getMessage('getting_secret_failure') + `: ${e.message}`);
  }
}

async function handleReveal(fullPathName) {
  try {
    return await fetchSecretValue(fullPathName);
  } catch (e) {
    if (isCancelled(e)) return null;
    notify.error(chrome.i18n.getMessage('getting_secret_failure') + `: ${e.message}`);
    return null;
  }
}

async function handleEdit(fullPathName) {
  try {
    const existingData = await fetchSecretData(fullPathName);
    const keys = Object.keys(existingData);
    const secretKey = keys.length > 1 ? await pickSecretKey(existingData) : keys[0];
    const data = await openEditSecretDialog(getItemName(fullPathName));
    const ok = await putSecret({ ...data, secretKey, existingData }, true);
    if (ok) await refreshExplorer();
  } catch (e) {
    if (isCancelled(e)) return;
    notify.error(e.message);
  }
}

async function handleDelete(fullPathName) {
  const name = getItemName(fullPathName);
  const confirmed = window.confirm(
    chrome.i18n.getMessage('delete_secret_confirm') + ` ${name}?`,
  );
  if (!confirmed) return;
  const ok = await deleteSecret(fullPathName);
  if (ok) await refreshExplorer(true);
}

/**
 * Build a list row for any item, delegating to the right renderer based on
 * whether the path ends with a slash.
 */
export function renderResultItem(fullPath, { showPath = false, ignoreError = false } = {}) {
  if (fullPath.endsWith('/')) {
    return renderDirectory(fullPath, {
      onOpen: (path) => openDirectory(path, ignoreError),
      showPath,
    });
  }
  return renderSecret(fullPath, {
    onFill: handleFill,
    onCopy: handleCopy,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onReveal: handleReveal,
  });
}

function makeSeparator() {
  const sep = document.createElement('span');
  sep.className = 'breadcrumb__sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '›';
  return sep;
}

function makeHomeSegment(isCurrent) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'breadcrumb__segment breadcrumb__home';
  btn.title = chrome.i18n.getMessage('backends_list');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
      <use xlink:href="../icons/home.svg#home"/>
    </svg>`;
  if (isCurrent) {
    btn.classList.add('breadcrumb__segment--current');
    btn.disabled = true;
  } else {
    btn.addEventListener('click', () => resetSearch());
  }
  return btn;
}

/**
 * Render a breadcrumb containing only the home button, clickable. Used while
 * a search is displayed so the user can always jump back to the root.
 */
export function renderSearchBreadcrumb() {
  const host = document.getElementById('current-path');
  host.textContent = '';
  host.appendChild(makeHomeSegment(false));
}

/**
 * Render `currentPath` as a Nautilus-style breadcrumb: a home icon that jumps
 * back to the backends list, followed by one clickable segment per directory.
 */
function renderBreadcrumb(path) {
  const host = document.getElementById('current-path');
  host.textContent = '';

  host.appendChild(makeHomeSegment(!path));
  if (!path) return;

  const parts = path.split('/').filter(Boolean);
  let accumulated = '';
  parts.forEach((segment, index) => {
    accumulated += segment + '/';
    const target = accumulated;
    const isLast = index === parts.length - 1;
    const label = segment === 'private' ? chrome.i18n.getMessage('private_directory') : segment;

    host.appendChild(makeSeparator());

    const crumb = document.createElement('button');
    crumb.type = 'button';
    crumb.className = 'breadcrumb__segment';
    crumb.textContent = label;
    if (isLast) {
      crumb.classList.add('breadcrumb__segment--current');
      crumb.disabled = true;
    } else {
      crumb.addEventListener('click', () => openDirectory(target));
    }
    host.appendChild(crumb);
  });
}

/**
 * List the direct children (directories + secrets) of a Vault path. On
 * failure, bubbles back up one level unless the caller asked to silence
 * errors (useful when opening a freshly-created empty backend).
 */
async function listVaultPathItems(fullPathName, ignoreError) {
  const hierarchy = fullPathName.split('/');
  const backend = hierarchy[0];
  const path = hierarchy.slice(1).join('/');
  try {
    const result = await Vault.get(`/${backend}/metadata/${path}?list=true`);
    return result.data.keys;
  } catch (e) {
    if (ignoreError) return [];
    notify.error(chrome.i18n.getMessage('getting_directory_failure') + ` ${e.message}`, {
      removeOption: true,
    });
    await goUpDirectory();
    return [];
  }
}

/** Re-render the explorer based on the persisted current path. */
export async function refreshExplorer(ignoreError = false) {
  resultList.textContent = '';
  await loadState();

  const currentPath = getCurrentPath();
  const backend = currentPath.split('/')[0];

  renderBreadcrumb(currentPath);
  document.getElementById('add-secret').style.display = 'none';

  let items;
  let ignore = ignoreError;
  if (currentPath === '') {
    items = getCurrentBackends().map((b) => b + '/');
    ignore = true;
  } else {
    items = await listVaultPathItems(currentPath, ignoreError);
    document.getElementById('add-secret').style.display = 'block';
  }

  for (const itemPath of items) {
    resultList.appendChild(renderResultItem(currentPath + itemPath, { ignoreError: ignore }));
  }
}

export async function resetSearch() {
  document.getElementById('vault-search').value = '';
  await storage.set(StorageKeys.INPUT_VALUE, '');
  await setCurrentPath('');
  await refreshExplorer();
}

export async function goUpDirectory() {
  await setCurrentPath(getParentPath(getCurrentPath()));
  await refreshExplorer();
}
