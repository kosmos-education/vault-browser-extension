/**
 * Page-side form filler.
 *
 * This function is injected into a tab via chrome.scripting.executeScript({
 *   func: fillCredentialsInPage, args: [{ username, password, isUserTriggered }]
 * }).
 *
 * Because executeScript serializes `func` through Function.prototype.toString,
 * this function MUST remain self-contained: no imports, no outer references.
 * Every helper it needs is therefore declared inside the function body.
 *
 * The function tries to locate the visible password field first, then looks
 * for a matching username field inside the same form (or the whole document
 * if no form wraps the password field).
 *
 * @param {{ username: string, password: string, isUserTriggered?: boolean }} request
 */
export function fillCredentialsInPage(request) {
  function createEvent(name) {
    const event = document.createEvent('Events');
    event.initEvent(name, true, true);
    return event;
  }

  function isVisible(node) {
    if (!node.offsetParent) return false;
    if (node.style.display === 'none') return false;
    if (node.style.visibility === 'hidden') return false;

    const computedStyle = window.getComputedStyle(node);
    return computedStyle.getPropertyValue('visibility') !== 'hidden';
  }

  function findPasswordInput() {
    const passwordNodes = document.querySelectorAll('input[type="password"]');
    for (const node of passwordNodes) {
      if (isVisible(node)) return node;
    }
    return passwordNodes.length > 0 ? passwordNodes[0] : null;
  }

  /**
   * Selectors are ordered from most specific (explicit semantic markers) to
   * most generic (plain text inputs). The first visible match wins.
   */
  const USERNAME_SELECTORS = [
    '[autocomplete="email"]',
    '[autocomplete="username"]',
    '[autocomplete="nickname"]',
    'input[id="username"]',
    'input[id="userid"]',
    'input[id="login"]',
    'input[id="email"]',
    'textarea[id="username"]',
    'textarea[id="userid"]',
    'textarea[id="login"]',
    'textarea[id="email"]',
    '[type="email"]',
    '[name="user_name"]',
    '[name="user"]',
    '[name="auth[username]"]',
    '[type="text"][name="username"]',
    '[type="text"][name="userid"]',
    '[type="text"][name="login"]',
    '[type="text"][name="email"]',
    '[type="text"][name="mail"]',
    '[type="text"][name="nickname"]',
    '[type="text"][name="nick"]',
  ];

  function findUsernameNodeIn(parentNode, checkVisibility, isUserTriggered = false) {
    const selectors = USERNAME_SELECTORS.slice();
    // Only fall back to a bare [type="text"] when we're scoped to a form or
    // the user explicitly asked for it, otherwise we would pick up unrelated
    // search fields on the page.
    if (parentNode instanceof HTMLFormElement || isUserTriggered) {
      selectors.push('[type="text"]');
    }

    for (const selector of selectors) {
      const candidates = parentNode.querySelectorAll(selector);
      for (const node of candidates) {
        if (!checkVisibility || isVisible(node)) return node;
      }
    }
    return null;
  }

  function fillIn(node, value) {
    node.focus();
    node.value = value;
    node.dispatchEvent(createEvent('input'));
    node.dispatchEvent(createEvent('change'));
    node.blur();
  }

  const passwordNode = findPasswordInput();
  // Some sites split credentials across multiple steps: we still fill the
  // password even when the username field cannot be found on this page.
  if (passwordNode) {
    fillIn(passwordNode, request.password);
  }

  const formNode = passwordNode?.closest('form');
  const usernameNode = formNode
    ? findUsernameNodeIn(formNode, true)
    : findUsernameNodeIn(document, true, request.isUserTriggered);

  if (!usernameNode) return;
  fillIn(usernameNode, request.username);
}
