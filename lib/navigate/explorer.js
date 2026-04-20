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
import { fetchSecretValue, deleteSecret, putSecret, isCancelled } from './secrets.js';
import { copyStringToClipboard, fillCredentialsInBrowser } from './browser-actions.js';
import { openEditSecretDialog } from '../dialog-form.js';

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
    const data = await openEditSecretDialog(getItemName(fullPathName));
    const ok = await putSecret(data, true);
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

/**
 * Render `currentPath` as a clickable breadcrumb so the user can jump back
 * to any ancestor level in a single click instead of chaining "go up".
 */
function renderBreadcrumb(path) {
  const host = document.getElementById('current-path');
  host.textContent = '';
  if (!path) return;

  const parts = path.split('/').filter(Boolean);
  let accumulated = '';
  parts.forEach((segment, index) => {
    accumulated += segment + '/';
    const target = accumulated;
    const isLast = index === parts.length - 1;
    const label = segment === 'private' ? chrome.i18n.getMessage('private_directory') : segment;

    if (index > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb__sep';
      sep.textContent = '/';
      host.appendChild(sep);
    }

    if (isLast) {
      const current = document.createElement('span');
      current.className = 'breadcrumb__segment breadcrumb__segment--current';
      current.textContent = label;
      host.appendChild(current);
      return;
    }

    const crumb = document.createElement('button');
    crumb.type = 'button';
    crumb.className = 'breadcrumb__segment nobutton link';
    crumb.textContent = label;
    crumb.addEventListener('click', () => openDirectory(target));
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
  document.getElementById('go-up').style.display =
    currentPath !== '' && backend !== 'private' ? 'block' : 'none';
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
