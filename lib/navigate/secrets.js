/**
 * Secret CRUD operations on top of the Vault client.
 *
 * Read paths (`fetchSecretValue`) throw on failure so callers can decide how
 * to surface the error; write paths (`putSecret`, `deleteSecret`) notify the
 * user directly and return a boolean so callers can decide whether to refresh.
 */

import Vault from '../vault.js';
import { pickSecretKey, isCancelled } from '../dialog-form.js';
import { notify } from './shared.js';
import { getCurrentPath, splitPath } from './state.js';

/**
 * Fetch the plain value of a secret.
 *
 * When the secret has a single key, returns that key's value directly. When
 * it has several keys, opens the "pick a key" dialog and resolves with the
 * chosen value — which means the caller must be ready to handle a
 * DialogCancelled rejection.
 *
 * @param {string} urlPath
 * @returns {Promise<string>}
 */
export async function fetchSecretValue(urlPath) {
  const { backend, subpath } = splitPath(urlPath);
  const result = await Vault.get(`/${backend}/data/${subpath}`);
  const data = result.data.data;
  const keys = Object.keys(data);
  return keys.length > 1 ? pickSecretKey(data) : data[keys[0]];
}

/**
 * Delete a secret (and its metadata). Reports success/failure to the user.
 * @returns {Promise<boolean>} true on success.
 */
export async function deleteSecret(urlPath) {
  const { backend, subpath } = splitPath(urlPath);
  try {
    await Vault.del(`/${backend}/metadata/${subpath}`);
    notify.success(chrome.i18n.getMessage('secret_deleted'), {
      time: 2000,
      removeOption: false,
    });
    return true;
  } catch (e) {
    notify.error(chrome.i18n.getMessage('delete_secret_failure') + `: ${e.message}`);
    return false;
  }
}

/**
 * Create or update a secret under the current path.
 *
 * @param {{ secretName: string, secretValue: string }} data
 * @param {boolean} [editMode=false]  Pick the "updated" success message.
 * @returns {Promise<boolean>} true on success.
 */
export async function putSecret({ secretName, secretValue }, editMode = false) {
  const { backend, subpath } = splitPath(getCurrentPath());
  try {
    await Vault.request('PUT', `/${backend}/data/${subpath}${secretName}`, {
      data: { value: secretValue },
    });
    const messageKey = editMode ? 'secret_updated' : 'secret_added';
    notify.success(chrome.i18n.getMessage(messageKey), {
      removeOption: false,
      time: 2000,
    });
    return true;
  } catch (e) {
    notify.clear().error(e.message);
    return false;
  }
}

export { isCancelled };
