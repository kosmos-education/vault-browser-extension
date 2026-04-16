/**
 * Notification helper. Appends notification nodes to a host element and
 * exposes a fluent API for `info()`, `success()`, `error()` and `clear()`.
 *
 * Messages are inserted as plain text (via `textContent`) to avoid XSS: the
 * host page should never be able to inject HTML through a notification.
 */
export default class Notify {
  /**
   * @param {HTMLElement} node host element that will contain notifications
   */
  constructor(node) {
    if (!node) throw new Error('Notify requires a host node');
    this.node = node;
    this.messages = [];
  }

  /**
   * @param {String} message plain text message
   * @param {Object} [options]
   * @param {Boolean} [options.removeOption=true] show the close button
   * @param {Number} [options.time] auto-dismiss delay in ms
   * @returns {Notify}
   */
  error(message, options) {
    return this.message({ level: 'error', message, ...options });
  }

  /**
   * @param {String} message plain text message
   * @param {Object} [options] see {@link Notify#error}
   * @returns {Notify}
   */
  success(message, options) {
    return this.message({ level: 'success', message, ...options });
  }

  /**
   * @param {String} message plain text message
   * @param {Object} [options] see {@link Notify#error}
   * @returns {Notify}
   */
  info(message, options) {
    return this.message({ level: 'info', message, ...options });
  }

  /**
   * @param {Object} options
   * @param {String} options.message plain text message
   * @param {'info'|'success'|'error'} [options.level='info']
   * @param {Boolean} [options.removeOption=true] show the close button
   * @param {Number} [options.time] auto-dismiss delay in ms
   * @returns {Notify}
   */
  message({ level = 'info', message, time, removeOption = true }) {
    const messageNode = document.createElement('div');
    messageNode.classList.add('notify', `notify--${level}`);
    messageNode.textContent = message == null ? '' : String(message);

    this.#append(messageNode);

    if (removeOption) this.#addRemoveOption(messageNode);
    if (time) setTimeout(() => messageNode.remove(), time);
    return this;
  }

  /**
   * Removes all notifications from the host node.
   * @returns {Notify}
   */
  clear() {
    this.node.replaceChildren();
    this.messages = [];
    return this;
  }

  #addRemoveOption(node) {
    const removeNode = document.createElement('button');
    removeNode.type = 'button';
    removeNode.textContent = '\u2716'; // ✖
    removeNode.classList.add('nobutton', 'link', 'notify__button');
    removeNode.addEventListener('click', () => node.remove());
    node.append(removeNode);
  }

  #append(node) {
    this.messages.push(node);
    this.node.append(node);
  }
}

/**
 * Convenience factory for callers that prefer a function over `new Notify()`.
 * @param {HTMLElement} node
 * @returns {Notify}
 */
export function createNotifier(node) {
  return new Notify(node);
}
