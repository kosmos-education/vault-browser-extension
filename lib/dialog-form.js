/**
 * Dialog helpers specific to the "navigate" page.
 *
 * These used to live in a jQuery-UI powered file; they're now thin wrappers
 * over the native <dialog> helpers in ./dialogs.js.
 */

import { openForm, pick, isCancelled } from './dialogs.js';

/**
 * Open the "create secret" dialog.
 * @returns {Promise<{ secretName: string, secretValue: string }>}
 */
export async function openCreateSecretDialog() {
  const data = await openForm('dialog-form-create');
  return {
    secretName: String(data.get('secret-name') ?? ''),
    secretValue: String(data.get('secret-value') ?? ''),
  };
}

/**
 * Open the "edit secret" dialog pre-filled with the given name.
 * @param {string} secretName
 * @returns {Promise<{ secretName: string, secretValue: string }>}
 */
export async function openEditSecretDialog(secretName) {
  const data = await openForm('dialog-form-edit', { 'secret-name': secretName });
  return {
    secretName,
    secretValue: String(data.get('secret-value') ?? ''),
  };
}

/**
 * Ask the user to pick one key from a multi-key secret.
 *
 * @param {Record<string, string>} secretData
 * @returns {Promise<string>} the value associated with the chosen key.
 */
export async function pickSecretKey(secretData) {
  const choices = Object.keys(secretData).map((key) => ({
    label: key,
    value: secretData[key],
  }));
  return pick('dialog-form-select-keys', choices);
}

export { isCancelled };