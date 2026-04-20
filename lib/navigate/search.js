/**
 * Cross-backend search.
 *
 * Splits the query on spaces and fires one "list" request per (backend,
 * keyword) pair. A row is shown when its path matches *all* keywords
 * (case-insensitive), so "app prod" matches both "prod-app" and "app/prod".
 */

import Vault from '../vault.js';
import { notify, resultList } from './shared.js';
import { getCurrentBackends } from './state.js';
import { renderResultItem } from './explorer.js';

async function searchBackend(backend, keyword) {
  try {
    const result = await Vault.get(`/${backend}/search/${keyword}/?list=true`);
    return { data: result, backendName: backend };
  } catch {
    return null;
  }
}

/**
 * Run a search and append matching rows to the result list.
 * @returns {Promise<boolean>} true when at least one row matched.
 */
export async function searchSecrets(searchString) {
  document.getElementById('current-path').textContent = '';
  document.getElementById('add-secret').style.display = 'none';
  resultList.textContent = '';
  notify.clear();

  if (searchString.length === 0) return false;

  const keywords = searchString.split(' ');
  const requests = [];
  for (const backend of getCurrentBackends()) {
    for (const keyword of keywords) {
      requests.push(searchBackend(backend, keyword));
    }
  }

  let matches = 0;
  try {
    const responses = (await Promise.all(requests)).filter(Boolean);
    for (const item of responses) {
      for (const itemName of item.data.data.keys) {
        const pathMatches = keywords.every((k) =>
          itemName.toUpperCase().includes(k.toUpperCase()),
        );
        if (!pathMatches) continue;
        resultList.appendChild(
          renderResultItem(`${item.backendName}${itemName}`, { showPath: true }),
        );
        matches++;
      }
    }
  } catch (e) {
    notify.error(chrome.i18n.getMessage('search_failure') + ` ${e.message}`, {
      removeOption: true,
    });
  }

  return matches !== 0;
}
