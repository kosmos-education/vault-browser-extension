const i18nBindings = {
  i18n_browse_secrets: 'browse_secrets',
  i18n_search_secret: 'search_secret',
  i18n_secret_create_name: 'secret_name',
  i18n_secret_create_value: 'secret_value',
  i18n_secret_edit_name: 'secret_name',
  i18n_secret_edit_value: 'secret_value',
  i18n_dialog_add_secret: 'dialog_add_secret',
  i18n_dialog_edit_secret: 'dialog_edit_secret',
  i18n_dialog_select_key: 'dialog_select_key',
  i18n_save_create: 'save',
  i18n_save_edit: 'save',
  i18n_cancel_create: 'cancel',
  i18n_cancel_edit: 'cancel',
  i18n_cancel_select: 'cancel',
};

for (const [elementId, messageKey] of Object.entries(i18nBindings)) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = chrome.i18n.getMessage(messageKey);
}