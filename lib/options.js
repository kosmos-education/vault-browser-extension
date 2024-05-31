import Vault from './vault.js'

/* eslint-disable no-console */

const notify = new Notify(document.querySelector('#notify'));
async function mainLoaded() {
  const vaultServer = document.getElementById('serverBox');
  const login = document.getElementById('loginBox');

  document
    .getElementById('authButton')
    .addEventListener('click', authButtonClick, false);
  document
    .getElementById('login')
    .addEventListener('keyup', function (e) { if (e.key === "Enter") { authButtonClick() } }, false);
  document
    .getElementById('logoutButton')
    .addEventListener('click', logout, false);

  const autoSearchOption = document.getElementById('autoSearch')
  
  autoSearchOption.addEventListener('change',e=>{
    console.log(e)
    browser.storage.local.set({ autoSearch:  e.target.checked})
  })

  autoSearchOption.checked = (await browser.storage.local.get('autoSearch')).autoSearch;

  await Vault.load()

  if (Vault.address) {
    vaultServer.value = Vault.address;
    vaultServer.parentNode.classList.add('is-dirty');
  }

  if (Vault.token) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('logout').style.display = 'block';
    document.getElementById('version').innerHTML = "Version: " + browser.runtime.getManifest().version;
    await refreshUserBackends();

  }


  const username = (await browser.storage.local.get('username')).username;
  if (username) {
    login.value = username;
    login.parentNode.classList.add('is-dirty');
  }

}

async function logout() {
  document.getElementById('login').style.display = 'block';
  document.getElementById('logout').style.display = 'none';

  const vaultServerAddress = (await browser.storage.sync.get('vaultAddress'))
    .vaultAddress;
  const vaultToken = (await browser.storage.local.get('vaultToken')).vaultToken;
  if (vaultToken) {
    try {
      await fetch(`${vaultServerAddress}/v1/auth/token/revoke-self`, {
        method: 'POST',
        'X-Vault-Token': vaultToken,
        'Content-Type': 'application/json',
      });
    } catch (err) {
      notify.clear().error(err.message);
    }
  }

  notify.clear().success(chrome.i18n.getMessage("logged_out"), { time: 1000, removeOption: false });
  await browser.storage.local.set({ vaultToken: null });
}


async function authButtonClick() {
  // get inputs from form elements, server URL, login and password
  const vaultServer = document.getElementById('serverBox');
  const login = document.getElementById('loginBox');
  const pass = document.getElementById('passBox');
  if (
    vaultServer.value.length > 0 &&
    login.value.length > 0 &&
    pass.value.length > 0
  ) {

    await browser.storage.local.set({ username: login.value });
    try {

      await Vault.setAddress(vaultServer.value)
      await Vault.login("ldap", {
        username: login.value,
        password: pass.value
      })
    } catch (e) {
      notify.clear().error(chrome.i18n.getMessage("login_failure") + ` ${e.message}`);
    }
  } else {
    notify.error(chrome.i18n.getMessage("fill_all_fields"));
  }
  mainLoaded()
}

document.addEventListener('DOMContentLoaded', mainLoaded, false);

async function refreshUserBackends() {
  notify.clear();
  let backends
  try {
    backends = await Vault.get('/sys/internal/ui/mounts')
  }
  catch (e) {
    notify.error(
      chrome.i18n.getMessage("getting_backends_failure")+ `: ${e.message}}`
    );
    return;
  }

  await displayBackends(backends.data.secret);

}

/*
  Display Vault user backends
 */
async function displayBackends(backends) {
  const hiddenBackends = ["sys", "cubbyhole", "identity"]
  const savedBackends = (await browser.storage.local.get('currentBackends')).currentBackends;

  const list = document.createElement('fieldset');
  const parent = document.getElementById("backendsList")
  parent.innerHTML = chrome.i18n.getMessage("backends_list")
  Object.entries(backends).forEach(([key, value]) => {
    const backendName = key.replace('/', '')
    if (!hiddenBackends.includes(backendName)) {
      const item = document.createElement('input');
      const label = document.createElement('label');
      label.className = "backendItem"
      label.innerHTML = backendName
      if (backendName === 'private'){
        label.innerHTML = chrome.i18n.getMessage("private_directory")
      }
    
      item.setAttribute("type", "checkbox")
      item.value = backendName;
      item.name = "backend";
      item.id = backendName;
      item.className = "backendCheckbox"

      if (savedBackends && savedBackends.includes(backendName)) {
        item.checked = true
      }
      // Create the list item:
      list.appendChild(label);
      label.appendChild(item);
    }

  })

  list.addEventListener('change', (event) => {
    let currentBackends = []
    document.querySelectorAll('input[name="backend"]:checked').forEach((checkbox) => currentBackends.push(checkbox.value));
    browser.storage.local.set({ currentBackends: currentBackends })

  });
  parent.appendChild(list)

}
