/**
 * Global request-loader indicator.
 *
 * Subscribes to Vault request lifecycle events and toggles a DOM element with
 * id `loader` whenever at least one request is in flight. Keeps a counter so
 * overlapping requests still resolve to a single shown/hidden state.
 */

import Vault from './vault.js';

let inFlight = 0;

export function initLoader() {
  const el = document.getElementById('loader');
  if (!el) return;

  Vault.subscribe((event) => {
    if (event === 'start') inFlight += 1;
    else if (event === 'end') inFlight = Math.max(0, inFlight - 1);
    el.hidden = inFlight === 0;
  });
}
