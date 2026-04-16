/* eslint-disable no-console */
/* global chrome */
import { copyStringToPageClipboard } from './lib/content/clipboard.js';
import { fillCredentialsInPage } from './lib/content/form-filler.js';

const idealTokenTTL = '24h';
const tokenCheckAlarm = 'tokenCheck';
const tokenRenewAlarm = 'tokenRenew';

setupTokenAutoRenew(1800);
refreshTokenTimer();
setupIdleListener();

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
  const tab = await chrome.tabs.query({ active: true, currentWindow: true }).then((t => { return t[0].id }));
  switch (request.message) {
    case 'copy_to_clipboard':
      chrome.scripting.executeScript({
        target: { tabId: tab },
        func: copyStringToPageClipboard,
        args: [request]
      })
      break;
    case 'fill_creds':
      chrome.scripting.executeScript({
        target: { tabId: tab },
        func: fillCredentialsInPage,
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
