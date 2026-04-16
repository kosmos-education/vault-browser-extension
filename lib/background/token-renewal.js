/* eslint-disable no-console */
/* global chrome */

/**
 * Background token renewal logic.
 *
 * Two alarms cooperate:
 *   - TOKEN_CHECK : short-delayed, fires once, looks up the current token's
 *                   TTL and decides whether to renew now or reschedule itself.
 *   - TOKEN_RENEW : periodic safety net that forces a renewal at a regular
 *                   cadence regardless of TTL.
 *
 * The idle listener also reacts to `active` / `locked` state changes so that
 * the token is refreshed when the user comes back or when the session locks.
 */

import { AlarmNames, IDEAL_TOKEN_TTL, StorageKeys } from '../constants.js';
import { getMany } from '../storage.js';

const LOOKUP_PATH = '/v1/auth/token/lookup-self';
const RENEW_PATH = '/v1/auth/token/renew-self';

/** Prefix logs with a timestamp so they line up in the SW console. */
function log(message) {
  console.log(`${new Date().toLocaleString()} ${message}`);
}

/**
 * Ask Vault about the current token and renew it when appropriate.
 *
 * @param {boolean} force  When true, renew unconditionally.
 */
export async function renewToken(force = false) {
  const { [StorageKeys.VAULT_TOKEN]: token, [StorageKeys.VAULT_ADDRESS]: address } =
    await getMany([StorageKeys.VAULT_TOKEN, StorageKeys.VAULT_ADDRESS]);

  if (!token || !address) {
    // Nothing to do until the user logs in; retry later.
    refreshTokenTimer();
    return;
  }

  try {
    const lookupRes = await fetch(address + LOOKUP_PATH, {
      method: 'GET',
      headers: {
        'X-Vault-Token': token,
        'Content-Type': 'application/json',
      },
    });
    const lookup = await lookupRes.json();
    const ttlMinutes = Math.round(lookup.data.ttl / 60);
    log(`Token will expire in ${ttlMinutes} minutes`);

    if (lookup.data.ttl > 3600) {
      refreshTokenTimer(1800);
    } else {
      refreshTokenTimer(lookup.data.ttl / 2);
    }

    if (force || lookup.data.ttl <= 600) {
      log('Renewing Token...');
      // Vault's renew-self accepts the increment in the POST body.
      const renewRes = await fetch(address + RENEW_PATH, {
        method: 'POST',
        headers: {
          'X-Vault-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ increment: IDEAL_TOKEN_TTL }),
      });
      const renew = await renewRes.json();
      const leaseMinutes = Math.round(renew.auth.lease_duration / 60);
      log(`Token renewed. It will expire in ${leaseMinutes} minutes`);
    }
  } catch (e) {
    console.log(e);
    refreshTokenTimer();
  }
}

/**
 * Create (or reset) the periodic "force renew" alarm.
 *
 * @param {number} intervalSeconds  Period between forced renewals.
 */
export function setupTokenAutoRenew(intervalSeconds = 1800) {
  chrome.alarms.get(AlarmNames.TOKEN_RENEW, (exists) => {
    if (exists) chrome.alarms.clear(AlarmNames.TOKEN_RENEW);
    chrome.alarms.create(AlarmNames.TOKEN_RENEW, {
      periodInMinutes: intervalSeconds / 60,
    });
  });
}

/**
 * Schedule the next one-off "check TTL" alarm.
 *
 * @param {number} delaySeconds  Delay before the next check.
 */
export function refreshTokenTimer(delaySeconds = 45) {
  chrome.alarms.get(AlarmNames.TOKEN_CHECK, (exists) => {
    if (exists) chrome.alarms.clear(AlarmNames.TOKEN_CHECK);
    chrome.alarms.create(AlarmNames.TOKEN_CHECK, {
      delayInMinutes: delaySeconds / 60,
    });
  });
}

/** Wire the idle state listener; forces a renew when the session is locked. */
export function setupIdleListener() {
  if (!chrome.idle.onStateChanged.hasListener(handleIdleState)) {
    chrome.idle.onStateChanged.addListener(handleIdleState);
  }
}

async function handleIdleState(newState) {
  log(newState);
  if (newState === 'active') await renewToken(false);
  if (newState === 'locked') await renewToken(true);
}

/** Register the alarm listener that drives both renewal alarms. */
export function setupAlarmListener() {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === AlarmNames.TOKEN_CHECK) await renewToken(false);
    if (alarm.name === AlarmNames.TOKEN_RENEW) await renewToken(true);
  });
}
