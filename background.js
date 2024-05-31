/* eslint-disable no-console */
/* global chrome */
const idealTokenTTL = '24h';
const tokenCheckAlarm = 'tokenCheck';
const tokenRenewAlarm = 'tokenRenew';
if (!chrome.browserAction) {
  chrome.browserAction = chrome.action;
}

setupTokenAutoRenew(1800);
refreshTokenTimer();
setupIdleListener();

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  const tab = await chrome.tabs.query({ active: true, currentWindow: true }).then((t => { return t[0].id }));
  switch (request.message) {
    case 'copy_to_clipboard':
      chrome.scripting.executeScript({
        target: { tabId: tab },
        func: handleCopyToClipboard,
        args: [request]
      })
      break;
    case 'fill_creds':
      chrome.scripting.executeScript({
        target: { tabId: tab },
        func: handleFillCredits,
        args: [request]
      })
      break;
    case 'token_missing':
      notify.error('Erreur de récupération des informations Vault');
      break;
  }
});

async function renewToken(force = false) {

  const token = (await browser.storage.local.get('vaultToken')).vaultToken;
  const address = (await browser.storage.local.get('vaultAddress')).vaultAddress;

  try {
    let res = await fetch(address+'/v1/auth/token/lookup-self', {
      method: 'GET',
      headers: {
        'X-Vault-Token': token,
        'Content-Type': 'application/json',
      }
    });

    const lookup = await res.json()
    console.log(
      `${new Date().toLocaleString()} Token will expire in ${lookup.data.ttl / 60
      } minutes`
    );
    if (lookup.data.ttl > 3600) {
      refreshTokenTimer(1800);
    } else {
      refreshTokenTimer((lookup.data.ttl / 2));
    }

    if (force || lookup.data.ttl <= 600) {
      console.log(`${new Date().toLocaleString()} Renewing Token...`);
      res = await fetch(address+'/auth/token/renew-self', {
        method: 'GET',
        headers: {
          'X-Vault-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({increment: idealTokenTTL})
      });
  
      const renew = await res.json()
      console.log(
        `${new Date().toLocaleString()} Token renewed. It will expire in ${renew.auth.lease_duration / 60
        } minutes`
      );
    }
  } catch (e) {
    console.log(e);
    refreshTokenTimer();
  }
}

function setupTokenAutoRenew(interval = 1800) {
  chrome.alarms.get(tokenRenewAlarm, function (exists) {
    if (exists) {
      chrome.alarms.clear(tokenRenewAlarm);
    }

    chrome.alarms.create(tokenRenewAlarm, {
      periodInMinutes: interval / 60
    });
  });
}

function refreshTokenTimer(delay = 45) {
  chrome.alarms.get(tokenCheckAlarm, function (exists) {
    if (exists) {
      chrome.alarms.clear(tokenCheckAlarm);
    }

    chrome.alarms.create(tokenCheckAlarm, {
      delayInMinutes: delay / 60
    });
  });
}

function setupIdleListener() {
  if (!chrome.idle.onStateChanged.hasListener(newStateHandler)) {
    chrome.idle.onStateChanged.addListener(newStateHandler);
  }
}

async function newStateHandler(newState) {
  console.log(`${new Date().toLocaleString()} ${newState}`);
  if (newState === 'active') {
    await renewToken(false);
  }

  if (newState === 'locked') {
    await renewToken(true);
  }
}

chrome.alarms.onAlarm.addListener(async function (alarm) {
  if (alarm.name === tokenCheckAlarm) {
    await renewToken();
  }

  if (alarm.name === tokenRenewAlarm) {
    await renewToken(true);
  }
})

chrome.runtime.onMessage.addListener(function (message, sender) {
  if (message.type === 'auto_renew_token') {
    refreshTokenTimer();
  }
});

/*
  Add secret content to clipboard
*/
function handleCopyToClipboard(request) {
  const el = document.createElement('textarea');
  el.value = request.string;
  el.setAttribute('readonly', '');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  const selected =
    document.getSelection().rangeCount > 0
      ? document.getSelection().getRangeAt(0)
      : false;
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  if (selected) {
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(selected);
  }
}


/*
  Inject secret content in username+password input in the current tab
  scripting.executeScript() requires functions to work in autonomy. Here, dependencies are nested inside it
*/
function handleFillCredits(request) {
  function createEvent(name) {
    const event = document.createEvent('Events');
    event.initEvent(name, true, true);
    return event;
  }

  function isVisible(node) {
    if (!node.offsetParent) {
      return false;
    }

    if (node.style.display === 'none') {
      return false;
    }

    if (node.style.visibility === 'hidden') {
      return false;
    }

    const computedStyle = window.getComputedStyle(node);
    const visibility = computedStyle.getPropertyValue('visibility');

    return visibility !== 'hidden';
  }

  function findPasswordInput() {
    // eslint-disable-next-line quotes
    const passwordNodes = document.querySelectorAll("input[type='password']");
    for (const node of passwordNodes) {
      if (isVisible(node)) return node;
    }

    return passwordNodes.length > 0 ? passwordNodes[0] : null;
  }

  function findUsernameNodeIn(
    parentNode,
    checkVisibility,
    isUserTriggered = false
  ) {
    const matches = [
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

    if (parentNode instanceof HTMLFormElement || isUserTriggered) {
      matches.push('[type="text"]');
    }

    for (const selector of matches) {
      const allUsernameNodes = parentNode.querySelectorAll(selector);

      let usernameNode = null;
      for (const node of allUsernameNodes) {
        if (checkVisibility ? isVisible(node) : true) {
          usernameNode = node;
          break;
        }
      }
      if (usernameNode) {
        return usernameNode;
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
  // A number of websites now prompt for the password separately
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
