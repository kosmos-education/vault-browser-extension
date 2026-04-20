/**
 * Page-wide navigation state.
 *
 * Holds `currentBackends` (the list of Vault mounts the user has selected)
 * and `currentPath` (the breadcrumb the user is browsing). Both are mirrored
 * into browser.storage.local so the popup survives a close-and-reopen.
 */

import { StorageKeys } from '../constants.js';
import * as storage from '../storage.js';

let currentBackends = [];
let currentPath = '';

export function getCurrentBackends() {
  return currentBackends;
}

export function getCurrentPath() {
  return currentPath;
}

/** Reload both state slots from storage. */
export async function loadState() {
  const [backends, path] = await Promise.all([
    storage.get(StorageKeys.CURRENT_BACKENDS),
    storage.get(StorageKeys.CURRENT_PATH),
  ]);
  currentBackends = Array.isArray(backends) ? backends : [];
  currentPath = path ?? '';
}

/** Persist + update `currentPath`. */
export async function setCurrentPath(newPath) {
  currentPath = newPath;
  await storage.set(StorageKeys.CURRENT_PATH, newPath);
}

/**
 * Split a Vault URL path into its backend mount and the remaining sub-path.
 *
 * `"secret/foo/bar"` -> `{ backend: "secret", subpath: "foo/bar" }`.
 */
export function splitPath(fullPath) {
  const hierarchy = fullPath.split('/');
  return {
    backend: hierarchy[0],
    subpath: hierarchy.slice(1).join('/'),
  };
}

/**
 * Return the last non-empty path segment — the human label of a secret or
 * directory.
 */
export function getItemName(fullPathName) {
  const parts = fullPathName.split('/');
  return parts[parts.length - 1] === '' ? parts[parts.length - 2] : parts[parts.length - 1];
}

/**
 * Return the parent path (with trailing slash) of a directory-style path, or
 * the empty string for a root-level path.
 */
export function getParentPath(fullPath) {
  const parent = fullPath.split('/').slice(0, -2).join('/');
  return parent === '' ? '' : parent + '/';
}
