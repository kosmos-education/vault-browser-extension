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
    await refreshUserBackends();

  }


  const username = (await browser.storage.local.get('username')).username;
  if (username) {
    login.value = username;
    login.parentNode.classList.add('is-dirty');
  }

  //Display extension version
  const versionElements = document.getElementsByClassName('version')
  Array.prototype.forEach.call(versionElements,e => {
    e.innerHTML = "Version: " + browser.runtime.getManifest().version;

  })

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
  const authMount = document.querySelector('input[name="auth_mount"]:checked').value;
  if (
    vaultServer.value.length > 0 &&
    login.value.length > 0 &&
    pass.value.length > 0
  ) {

    await browser.storage.local.set({ username: login.value });
    try {

      await Vault.setAddress(vaultServer.value)
      await Vault.login(authMount, {
        username: login.value,
        password: pass.value,
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
  const parent = document.getElementById("backendsList")
  parent.innerHTML = "<span class='label'>"+chrome.i18n.getMessage("backends_list")+"</span>"
  const list = document.createElement('ul');
  list.className = "responsive-table"
  Object.entries(backends).forEach(([key, value]) => {
    const backendName = key.replace('/', '')
    if (!hiddenBackends.includes(backendName)) {
      const row = document.createElement('li')
      row.className = "table-row"
      const box = document.createElement('input');
      const rowLabel = document.createElement('div');
      rowLabel.classList.add('col','col-1')
      rowLabel.innerHTML = backendName
      if (backendName === 'private'){
        rowLabel.innerHTML = chrome.i18n.getMessage("private_directory")
      }
    
      box.setAttribute("type", "checkbox")
      box.value = backendName;
      box.name = "backend";
      box.id = backendName;
      box.classList.add('col','col-2','backendCheckbox')

      if (savedBackends && savedBackends.includes(backendName)) {
        box.checked = true
      }
      // Create the list item:
      row.appendChild(rowLabel);
      row.appendChild(box);
      list.appendChild(row);

    }

  })

  list.addEventListener('change', (event) => {
    let currentBackends = []
    document.querySelectorAll('input[name="backend"]:checked').forEach((checkbox) => currentBackends.push(checkbox.value));
    browser.storage.local.set({ currentBackends: currentBackends })

  });
  parent.appendChild(list)

}
