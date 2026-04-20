/**
 * Pure DOM renderers for the two kinds of list rows.
 *
 * Rows get their behavior from callbacks passed by the caller — these
 * functions do not know about Vault, storage, or navigation state.
 */

import { getItemName } from './state.js';
import { openRevealSecretDialog } from '../dialog-form.js';

function baseListItem() {
  const li = document.createElement('li');
  li.classList.add('list__item', 'list__item--three-line');
  return li;
}

function primaryButton(title) {
  const btn = document.createElement('button');
  btn.title = title;
  btn.classList.add(
    'list__item-primary-content',
    'list__item-button',
    'nobutton',
    'js-button',
    'js-ripple-effect',
  );
  return btn;
}

function iconButton(iconFile, symbolId, title) {
  const btn = document.createElement('button');
  btn.classList.add('button');
  btn.title = title;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
      <use xlink:href="../icons/${iconFile}#${symbolId}"/>
    </svg>`;
  return btn;
}

let rowMenuAutoCloseInited = false;

/**
 * Install once-per-page listeners that close any open row menu when the user
 * clicks outside a menu or presses Escape.
 */
function initRowMenuAutoClose() {
  if (rowMenuAutoCloseInited) return;
  rowMenuAutoCloseInited = true;

  document.addEventListener('click', (event) => {
    for (const panel of document.querySelectorAll('.row-menu__panel:not([hidden])')) {
      if (!panel.closest('.row-menu').contains(event.target)) panel.hidden = true;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const panel of document.querySelectorAll('.row-menu__panel:not([hidden])')) {
      panel.hidden = true;
    }
  });
}

/**
 * Build a "more actions" dropdown button + its panel of menu items.
 *
 * @param {{ label: string, action: string, onClick: () => void }[]} entries
 */
function createRowMenu(entries) {
  initRowMenuAutoClose();

  const wrapper = document.createElement('div');
  wrapper.classList.add('row-menu');

  const trigger = iconButton('more.svg', 'more', chrome.i18n.getMessage('more_actions'));
  trigger.dataset.action = 'more';
  wrapper.appendChild(trigger);

  const panel = document.createElement('div');
  panel.classList.add('row-menu__panel');
  panel.hidden = true;
  wrapper.appendChild(panel);

  for (const { label, action, onClick } of entries) {
    const item = document.createElement('button');
    item.type = 'button';
    item.classList.add('row-menu__item');
    item.dataset.action = action;
    item.textContent = label;
    item.addEventListener('click', () => {
      panel.hidden = true;
      onClick();
    });
    panel.appendChild(item);
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasHidden = panel.hidden;
    for (const p of document.querySelectorAll('.row-menu__panel')) p.hidden = true;
    panel.hidden = !wasHidden;
  });

  return wrapper;
}

/**
 * Render a directory row.
 *
 * @param {string} fullPathName   `"backend/dir/subdir/"`.
 * @param {{ onOpen: (fullPath: string) => void, showPath?: boolean }} handlers
 */
export function renderDirectory(fullPathName, { onOpen, showPath = false }) {
  const item = baseListItem();
  const primary = primaryButton('Ouvrir');
  primary.addEventListener('click', () => onOpen(fullPathName));

  const title = document.createElement('span');
  const detail = document.createElement('span');
  detail.classList.add('list__item-text-body');
  title.classList.add('list__item-path-title', 'link');

  const name = getItemName(fullPathName);
  title.textContent = name === 'private'
    ? chrome.i18n.getMessage('private_directory')
    : name;
  detail.textContent = showPath ? fullPathName : '';

  primary.append(title, detail);
  item.append(primary);
  return item;
}

/**
 * Render a secret row.
 *
 * @param {string} fullPathName
 * @param {{
 *   onFill: (fullPath: string) => void,
 *   onCopy: (fullPath: string) => void,
 *   onEdit: (fullPath: string) => void,
 *   onDelete: (fullPath: string) => void,
 *   onReveal: (fullPath: string) => Promise<string|null>,
 * }} handlers
 */
export function renderSecret(fullPathName, handlers) {
  const { onFill, onCopy, onEdit, onDelete, onReveal } = handlers;
  const item = baseListItem();

  const primary = primaryButton(chrome.i18n.getMessage('copy_browser'));
  primary.addEventListener('click', () => onFill(fullPathName));

  const title = document.createElement('span');
  const detail = document.createElement('span');
  detail.classList.add('list__item-text-body');
  title.classList.add('list__item-secret-title', 'link');

  title.textContent = getItemName(fullPathName);
  detail.textContent = fullPathName;

  primary.append(title, detail);
  item.append(primary);

  const revealBtn = iconButton('eye.svg', 'eye', chrome.i18n.getMessage('reveal_secret'));
  revealBtn.dataset.action = 'reveal';
  revealBtn.addEventListener('click', async () => {
    const value = await onReveal(fullPathName);
    if (value == null) return;
    await openRevealSecretDialog(value);
  });

  const copyBtn = iconButton('copy-key.svg', 'copy', chrome.i18n.getMessage('copy_clipboard'));
  copyBtn.dataset.action = 'copy';
  copyBtn.addEventListener('click', () => onCopy(fullPathName));

  const moreMenu = createRowMenu([
    {
      label: chrome.i18n.getMessage('edit_secret'),
      action: 'edit',
      onClick: () => onEdit(fullPathName),
    },
    {
      label: chrome.i18n.getMessage('delete_secret'),
      action: 'delete',
      onClick: () => onDelete(fullPathName),
    },
  ]);

  const actions = document.createElement('div');
  actions.classList.add('list__item-actions');
  actions.append(revealBtn, copyBtn, moreMenu);
  item.append(actions);
  return item;
}
