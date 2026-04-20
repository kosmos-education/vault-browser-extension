/**
 * Singletons reused across the navigate page modules.
 *
 * Module scripts are deferred by default, so the DOM is guaranteed to be
 * available by the time this module is first imported.
 */

import Notify from '../notify.js';

export const notify = new Notify(document.querySelector('#notify'));

export const resultList = document.getElementById('resultList');
