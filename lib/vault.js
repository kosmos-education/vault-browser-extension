/* global browser */
/**
 * Vault API client.
 *
 * Holds the user's token and the base URL, and exposes the minimal subset of
 * HTTP verbs needed by the rest of the extension. Consumers import the default
 * singleton (`vault`) and must call `await vault.load()` before any request.
 */

import { StorageKeys, IDEAL_TOKEN_TTL, MessageTypes } from './constants.js';
import * as storage from './storage.js';
import { sendMessage } from './messages.js';

class Vault {
  constructor() {
    this.token = null;
    this.address = null;
    this.base = null;
  }

  /** Re-hydrate the singleton from storage. Must be called before any request. */
  async load() {
    const { [StorageKeys.VAULT_TOKEN]: token, [StorageKeys.VAULT_ADDRESS]: address } =
      await storage.getMany([StorageKeys.VAULT_TOKEN, StorageKeys.VAULT_ADDRESS]);
    this.token = token ?? null;
    this.address = address ?? null;
    this.base = this.address ? `${this.address}/v1` : null;
  }

  /** True when a server-side `lookup-self` succeeds with the current token. */
  async isLoggedIn() {
    if (!this.address || !this.token) return false;

    try {
      const res = await fetch(`${this.base}/auth/token/lookup-self`, {
        method: 'GET',
        headers: this.#headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async setAddress(address) {
    this.address = address;
    this.base = `${address}/v1`;
    await storage.set(StorageKeys.VAULT_ADDRESS, address);
  }

  async setToken(token) {
    this.token = token;
    await storage.set(StorageKeys.VAULT_TOKEN, token);
  }

  /**
   * Exchange credentials against the given auth mount and persist the token.
   * Also asks the background page to (re)start the token-renewal timer.
   */
  async login(authMount, credentials) {
    const apiResponse = await this.request(
      'POST',
      `/auth/${authMount}/login/${credentials.username}`,
      { password: credentials.password }
    );
    const authInfo = apiResponse.auth;
    await this.setToken(authInfo.client_token);

    sendMessage(MessageTypes.AUTO_RENEW_TOKEN);

    // If the server handed out a short-lived token, extend it so users don't
    // have to re-authenticate several times a day.
    if (authInfo.lease_duration < 86400) {
      await this.request('POST', '/auth/token/renew-self', { increment: IDEAL_TOKEN_TTL });
    }
  }

  /** Best-effort: revoke the token server-side, then wipe local storage. */
  async logout() {
    if (this.token) {
      try {
        await this.request('POST', '/auth/token/revoke-self');
      } catch (e) {
        // Revocation is advisory; we still want to clear local state below.
        console.warn('[vault] revoke-self failed', e);
      }
    }
    this.token = null;
    this.address = null;
    this.base = null;
    await storage.clear();
  }

  /**
   * Execute a Vault HTTP call and return the parsed JSON body (or `{}` when
   * the response has no body, e.g. 204).
   */
  async request(method, endpoint, content = null) {
    const verb = method.toUpperCase();
    const res = await fetch(this.base + endpoint, {
      method: verb,
      headers: this.#headers(),
      body: content != null ? JSON.stringify(content) : null,
    });

    if (!res.ok) {
      throw new Error(`${verb} ${this.base}${endpoint} (HTTP ${res.status})`);
    }

    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  list(endpoint) {
    return this.request('LIST', endpoint);
  }

  get(endpoint) {
    return this.request('GET', endpoint);
  }

  post(endpoint, content) {
    return this.request('POST', endpoint, content);
  }

  del(endpoint) {
    return this.request('DELETE', endpoint);
  }

  /** Build the headers every authenticated request needs. */
  #headers() {
    return {
      'X-Vault-Token': this.token,
      'Content-Type': 'application/json',
    };
  }
}

const vault = new Vault();
export default vault;
