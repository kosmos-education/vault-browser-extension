/**
 * Page-side clipboard helper.
 *
 * This function is injected into a tab via chrome.scripting.executeScript({
 *   func: copyStringToPageClipboard, args: [{ string }]
 * }).
 *
 * Because executeScript serializes `func` through Function.prototype.toString,
 * this function MUST remain self-contained: no imports, no outer references.
 * Every helper it needs has to be declared inside the function body.
 *
 * @param {{ string: string }} request payload sent by the background script
 */
export function copyStringToPageClipboard(request) {
  const el = document.createElement('textarea');
  el.value = request.string;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);

  if (previousRange && selection) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }
}
