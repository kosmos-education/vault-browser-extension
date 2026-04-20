/**
 * Keyboard navigation across the result list.
 *
 * Arrow keys move focus between rows (with roll-off back to the search
 * input at the top), Enter triggers the row's primary action via native
 * <button> semantics, `c` copies the current secret to the clipboard,
 * and Escape returns focus to the search input.
 */

export function initKeyboardNav() {
  document.addEventListener('keydown', onKeydown);
}

function onKeydown(event) {
  const list = document.getElementById('resultList');
  if (!list) return;

  const items = Array.from(list.querySelectorAll('.list__item-button'));
  if (!items.length && event.key !== 'Escape') return;

  const active = document.activeElement;
  const searchInput = document.getElementById('vault-search');
  const currentIdx = items.findIndex((el) => el === active);
  const inSearch = active === searchInput;

  switch (event.key) {
    case 'ArrowDown':
      if (inSearch || currentIdx === -1) items[0]?.focus();
      else items[Math.min(currentIdx + 1, items.length - 1)].focus();
      event.preventDefault();
      break;

    case 'ArrowUp':
      if (currentIdx === 0) searchInput?.focus();
      else if (currentIdx > 0) items[currentIdx - 1].focus();
      else return;
      event.preventDefault();
      break;

    case 'Escape':
      searchInput?.focus();
      break;

    case 'c':
      if (inSearch || currentIdx === -1) return;
      const copyBtn = items[currentIdx]
        .closest('.list__item')
        ?.querySelector('[data-action="copy"]');
      if (!copyBtn) return;
      copyBtn.click();
      event.preventDefault();
      break;
  }
}
