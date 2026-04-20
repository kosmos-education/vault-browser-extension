/**
 * Native <dialog> helpers.
 *
 * Thin convenience layer around HTMLDialogElement that gives each dialog:
 *   - a promise-based openForm() which resolves on submit and rejects on cancel
 *   - automatic form reset on close
 *   - declarative lookups by id so callers don't juggle DOM references
 *
 * A dialog is cancelled when the user presses Escape, triggers the close event
 * without submitting, or clicks a button with `value="cancel"`.
 */

/** Error raised when a dialog is dismissed without submitting. */
export class DialogCancelled extends Error {
  constructor() {
    super('dialog cancelled');
    this.name = 'DialogCancelled';
  }
}

function getDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error(`#${dialogId} is not a <dialog>`);
  }
  return dialog;
}

/**
 * Open a `<dialog>` containing a `<form>` and resolve with the form values
 * when the user submits, or reject when the dialog is dismissed.
 *
 * @param {string} dialogId
 * @param {Object<string,string>} [prefill]  Optional map of input name -> initial value.
 * @returns {Promise<FormData>}
 */
export function openForm(dialogId, prefill = {}) {
  const dialog = getDialog(dialogId);
  const form = dialog.querySelector('form');
  if (!form) return Promise.reject(new Error(`#${dialogId} has no <form>`));

  for (const [name, value] of Object.entries(prefill)) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  }

  const cancelBtn = dialog.querySelector('button[value="cancel"]');

  return new Promise((resolve, reject) => {
    function onSubmit(event) {
      event.preventDefault();
      const data = new FormData(form);
      cleanup();
      dialog.close('submit');
      resolve(data);
    }
    function onCancelClick() {
      dialog.close('cancel');
    }
    function onClose() {
      cleanup();
      form.reset();
      if (dialog.returnValue !== 'submit') reject(new DialogCancelled());
    }
    function cleanup() {
      form.removeEventListener('submit', onSubmit);
      dialog.removeEventListener('close', onClose);
      cancelBtn?.removeEventListener('click', onCancelClick);
    }
    form.addEventListener('submit', onSubmit);
    dialog.addEventListener('close', onClose);
    cancelBtn?.addEventListener('click', onCancelClick);
    dialog.showModal();
  });
}

/**
 * Open a dialog that behaves like a picker.
 *
 * The caller provides a list of `{ label, value }` choices; the dialog renders
 * one button per choice inside the element flagged with `[data-choices]` and
 * resolves with the chosen value.
 *
 * @param {string} dialogId
 * @param {{ label: string, value: any }[]} choices
 * @returns {Promise<any>}
 */
export function pick(dialogId, choices) {
  const dialog = getDialog(dialogId);
  const host = dialog.querySelector('[data-choices]') ?? dialog;
  host.textContent = '';

  const cancelBtn = dialog.querySelector('button[value="cancel"]');

  return new Promise((resolve, reject) => {
    function onCancelClick() {
      dialog.close('cancel');
    }
    function onClose() {
      cleanup();
      host.textContent = '';
      if (dialog.returnValue !== 'submit') reject(new DialogCancelled());
    }
    function cleanup() {
      dialog.removeEventListener('close', onClose);
      cancelBtn?.removeEventListener('click', onCancelClick);
    }

    for (const { label, value } of choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        cleanup();
        dialog.close('submit');
        resolve(value);
      });
      host.appendChild(btn);
    }
    dialog.addEventListener('close', onClose);
    cancelBtn?.addEventListener('click', onCancelClick);
    dialog.showModal();
  });
}

/**
 * Open a read-only dialog that displays a value in the element flagged
 * with `[data-reveal-value]`. Resolves when the dialog is closed.
 *
 * @param {string} dialogId
 * @param {string} value
 * @returns {Promise<void>}
 */
export function showValue(dialogId, value) {
  const dialog = getDialog(dialogId);
  const host = dialog.querySelector('[data-reveal-value]');
  if (host) host.textContent = value;

  const cancelBtn = dialog.querySelector('button[value="cancel"]');

  return new Promise((resolve) => {
    function onCancelClick() {
      dialog.close();
    }
    function onClose() {
      cancelBtn?.removeEventListener('click', onCancelClick);
      dialog.removeEventListener('close', onClose);
      if (host) host.textContent = '';
      resolve();
    }
    cancelBtn?.addEventListener('click', onCancelClick);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
}

/** True when an error comes from a dismissed dialog. */
export function isCancelled(err) {
  return err instanceof DialogCancelled;
}