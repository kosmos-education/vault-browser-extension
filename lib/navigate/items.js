/**
 * Pure DOM renderers for the two kinds of list rows.
 *
 * Rows get their behavior from callbacks passed by the caller — these
 * functions do not know about Vault, storage, or navigation state.
 */

import { getItemName } from './state.js';

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
 * }} handlers
 */
export function renderSecret(fullPathName, handlers) {
  const { onFill, onCopy, onEdit, onDelete } = handlers;
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

  const editBtn = iconButton('edit.svg', 'edit', chrome.i18n.getMessage('edit_secret'));
  editBtn.addEventListener('click', () => onEdit(fullPathName));

  const copyBtn = iconButton('copy-key.svg', 'copy', chrome.i18n.getMessage('copy_clipboard'));
  copyBtn.addEventListener('click', () => onCopy(fullPathName));

  const deleteBtn = iconButton('delete.svg', 'delete', chrome.i18n.getMessage('delete_secret'));
  deleteBtn.addEventListener('click', () => onDelete(fullPathName));

  const actions = document.createElement('div');
  actions.classList.add('list__item-actions');
  actions.append(editBtn, copyBtn, deleteBtn);
  item.append(actions);
  return item;
}
