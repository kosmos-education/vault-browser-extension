/**
 * Centralised string constants used across the extension.
 * Importing from this module prevents typos and eases refactoring.
 */

/** Keys used with browser.storage.local. */
export const StorageKeys = Object.freeze({
  VAULT_TOKEN: 'vaultToken',
  VAULT_ADDRESS: 'vaultAddress',
  USERNAME: 'username',
  CURRENT_BACKENDS: 'currentBackends',
  CURRENT_PATH: 'currentPath',
  INPUT_VALUE: 'inputValue',
  DOMAIN: 'domain',
  AUTO_SEARCH: 'autoSearch',
});

/** runtime.sendMessage / onMessage action names. */
export const MessageTypes = Object.freeze({
  COPY_TO_CLIPBOARD: 'copy_to_clipboard',
  FILL_CREDS: 'fill_creds',
  TOKEN_MISSING: 'token_missing',
  AUTO_RENEW_TOKEN: 'auto_renew_token',
});

/** Alarm names used by the background service worker. */
export const AlarmNames = Object.freeze({
  TOKEN_CHECK: 'tokenCheck',
  TOKEN_RENEW: 'tokenRenew',
});

/** Target lease duration requested when renewing the Vault token. */
export const IDEAL_TOKEN_TTL = '24h';

/**
 * Vault backends that must never be shown to the user on the options screen.
 * These are internal / system mounts.
 */
export const HIDDEN_BACKENDS = Object.freeze(['sys', 'cubbyhole', 'identity']);
