/* eslint-disable no-console */
/* eslint-disable no-prototype-builtins */
/* global browser Notify storePathComponents */
import Vault from './vault.js'

const notify = new Notify(document.querySelector('#notify'));
const resultList = document.getElementById('resultList');
const searchInput = document.getElementById('vault-search');

var currentBackends;
var currentPath;

document.addEventListener('DOMContentLoaded', mainLoaded, false);
document.addEventListener('secret-added', function (event) {
  putSecret(event.detail)
}, false);

document.addEventListener('secret-updated', function (event) {
  putSecret(event.detail,true)
}, false);


async function mainLoaded() {
  notify.clear();
  currentBackends = {}
  currentPath = ''

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    const tab = tabs[tabIndex];
  }
  await Vault.load()
  const vaultStatus = await Vault.isLoggedIn()

  if (vaultStatus) {
    await refreshExplorer();
    const autoSearch = (await browser.storage.local.get('autoSearch')).autoSearch;
      const currentTab = await chrome.tabs.query({active: true, currentWindow: true})
      const url = new URL(currentTab[0].url);
      const domain = url.hostname
      const cachedDomain = (await browser.storage.local.get('domain')).domain;

      //Disable auto search when staying on the current page
      if (autoSearch && cachedDomain != domain){
        try{
          const domainList = domain.split('.')
          const mainDomain = (domainList[0]) === 'www' ? domainList[1] : domainList[0]
          const found = await searchSecrets(mainDomain)
          browser.storage.local.set({ domain: domain });

          if (found){
            notify.info(chrome.i18n.getMessage("secret_found")+mainDomain, {
            removeOption: true,
            });
          }else{
            await refreshExplorer()
            notify.info(chrome.i18n.getMessage("secret_notfound")+mainDomain, {
              removeOption: true,
            });
          } 
        }catch (e) {}
      }else{
        //Avoid conflict between manual search & auto search
        searchInput.value = (await browser.storage.local.get('inputValue')).inputValue || "";
      }

  }else{
    document.getElementById('result').style.display = 'none';
    return notify.clear().info(
      chrome.i18n.getMessage("please_connect"),
      { removeOption: false }
    );
  }

  document.getElementById('go-up').addEventListener('click', goUpDirectory, false);
  document.getElementById('go-beginning').addEventListener('click', resetSearch, false);

}

// Refresh current list of secrets and directories
async function refreshExplorer(ignoreError = false) {
  resultList.textContent = ''
  currentBackends = (await browser.storage.local.get('currentBackends')).currentBackends || '';
  currentPath = (await browser.storage.local.get('currentPath')).currentPath || '';
  const backend = currentPath.split("/")[0]


  document.getElementById('current-path').innerText = currentPath

  //Hide "Go Up" button if we're in root directory or private directory
  document.getElementById('go-up').style.display = (currentPath !== '' && backend !== 'private') ? 'block' : 'none';
  document.getElementById('add-secret').style.display = 'none';

  let items;
  if (currentPath === '') {
    //Display user backends (root directory)
    items = currentBackends.map(b => b + "/")
    //Ignore 404 error when backend is empty 
    ignoreError = true

  } else {
    //Display subdirectories
    items = await listVaultPathItems(currentPath, ignoreError)
    document.getElementById('add-secret').style.display = 'block';
  }
  items.forEach((itemPath) => { (itemPath.slice(-1) === "/") ? resultList.appendChild(displayDirectory(currentPath + itemPath,false,ignoreError)) : resultList.appendChild(displaySecret(currentPath + itemPath)) })

}


//List content of the current directory
async function listVaultPathItems(fullPathName, ignoreError) {
  const hierarchy = fullPathName.split("/")
  const backend = hierarchy[0]
  const path = hierarchy.slice(1).join("/")
  let result;

  try {
    result = await Vault.get(`/${backend}/metadata/${path}?list=true`)
  } catch (e) {
    if (ignoreError) {
      return []
    }
    notify.error(chrome.i18n.getMessage("getting_directory_failure")+` ${e.message}`, {
      removeOption: true,
    });
    goUpDirectory()
  }

  return result.data["keys"]
}


function displayDirectory(fullPathName, showPath = false,ignoreError=false) {

  const item = document.createElement('li');
  item.classList.add('list__item', 'list__item--three-line');

  const primaryContent = document.createElement('button');

  //Display private directory
  if (fullPathName === 'private/') {
    primaryContent.addEventListener('click',async function () {
      const username = (await browser.storage.local.get('username')).username;
      setCurrentPath(fullPathName + username + '/',ignoreError);
    });
  } else {
    primaryContent.addEventListener('click', function () {
      setCurrentPath(fullPathName,ignoreError);
    });
  }


  primaryContent.title = 'Ouvrir';
  primaryContent.classList.add(
    'list__item-primary-content',
    'list__item-button',
    'nobutton',
    'js-button',
    'js-ripple-effect'
  );

  const titleContent = document.createElement('span');
  const detailContent = document.createElement('span');
  detailContent.classList.add('list__item-text-body');

  //Display directory
  titleContent.classList.add('list__item-path-title', 'link');
  const name = getItemName(fullPathName)
  if (name === 'private') {
    titleContent.textContent = chrome.i18n.getMessage("private_directory")
  } else {
    titleContent.textContent = getItemName(fullPathName)
  }
  detailContent.textContent = (showPath) ? fullPathName : '';

  primaryContent.appendChild(titleContent);
  primaryContent.appendChild(detailContent);
  item.appendChild(primaryContent);

  return item;
}

function displaySecret(fullPathName) {

  const item = document.createElement('li');
  item.classList.add('list__item', 'list__item--three-line');

  const primaryContent = document.createElement('button');
  primaryContent.addEventListener('click', function () {
    fetchSecretContent(fullPathName,(value) => { fillCredentialsInBrowser(getItemName(fullPathName), value); })
  });

  primaryContent.title = chrome.i18n.getMessage("copy_browser")
  primaryContent.classList.add(
    'list__item-primary-content',
    'list__item-button',
    'nobutton',
    'js-button',
    'js-ripple-effect'
  );

  const titleContent = document.createElement('span');
  const detailContent = document.createElement('span');
  detailContent.classList.add('list__item-text-body');

  titleContent.classList.add('list__item-secret-title', 'link');
  titleContent.textContent = getItemName(fullPathName);
  detailContent.textContent = fullPathName;

  const copyValueButton = document.createElement('button');
  const deleteButton = document.createElement('button');
  const editButton = document.createElement('button');
  copyValueButton.classList.add('button');
  editButton.classList.add('button');
  deleteButton.classList.add('button');
  editButton.title = chrome.i18n.getMessage("edit_secret")
  copyValueButton.title = chrome.i18n.getMessage("copy_clipboard")
  deleteButton.title = chrome.i18n.getMessage("delete_secret")

  editButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
    <use xlink:href="../icons/edit.svg#edit"/>
    </svg>`;
  copyValueButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
    <use xlink:href="../icons/copy-key.svg#copy"/>
    </svg>`;
  deleteButton.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
    <use xlink:href="../icons/delete.svg#delete"/>
  </svg>`;
  copyValueButton.addEventListener('click', function () {
    fetchSecretContent(fullPathName, (value) => { copyStringToClipboard(value) })

  });
  editButton.id="edit-secret"
  editButton.data={secretName: getItemName(fullPathName)}


  deleteButton.addEventListener('click', async function () {
    if (window.confirm(chrome.i18n.getMessage("delete_secret_confirm")+` ${getItemName(fullPathName)}?`)) {
      await deleteSecret(fullPathName)
      refreshExplorer(true)
    }
  });

  primaryContent.appendChild(titleContent);
  primaryContent.appendChild(detailContent);
  item.appendChild(primaryContent);

  const actions = document.createElement('div');
  actions.classList.add('list__item-actions');
  actions.appendChild(editButton);
  actions.appendChild(copyValueButton);
  actions.appendChild(deleteButton);
  item.appendChild(actions);
  return item;
}

/*
  Fetch secret data from Vault
  Manage secrets with multiple keys
  Then, call the function in parameter with the secret's value
 */
async function fetchSecretContent(urlPath,callback) {
  const hierarchy = urlPath.split("/")
  const backend = hierarchy[0]
  const backendPath = hierarchy.slice(1).join("/")

  let result

  try {
    result = await Vault.get(`/${backend}/data/${backendPath}`)
  }
  catch (e) {
    notify.error(chrome.i18n.getMessage("getting_secret_failure")`: ${e.message}`);
  }

  //If the secret contains multiple keys, display the selection box
  return (Object.keys(result.data.data).length>1) ? chooseSecretKey(result.data.data,callback) : callback(result.data.data[Object.keys(result.data.data)[0]])
}

/*
  Display a selection box when the secret contains multiple keys
  Returns value of the selected key
 */
function chooseSecretKey(secretContent,callback){

  const selectKeysForm = document.getElementById("select-keys-fieldset")
  const closeEvent = new Event("close")
  const openEvent = new Event("open")
  Object.keys(secretContent).forEach(key =>{
    const btn = document.createElement("button")
    btn.textContent = key
    btn.addEventListener('click',function (){
      selectKeysForm.dispatchEvent(closeEvent)
      callback(secretContent[key])
    })
    selectKeysForm.appendChild(btn)
  })
  selectKeysForm.dispatchEvent(openEvent);
}

async function deleteSecret(urlPath) {
  const hierarchy = urlPath.split("/")
  const backend = hierarchy[0]
  const backendPath = hierarchy.slice(1).join("/")

  try {
    await Vault.del(`/${backend}/metadata/${backendPath}`)
    notify.success(chrome.i18n.getMessage("secret_deleted"),{
      time: 2000,
      removeOption: false
    });
  }
  catch (e) {
    notify.error(chrome.i18n.getMessage("delete_secret_failure")`: ${e.message}`);
  }
}

// Call /backend/search
async function searchSecrets(searchString) {
  document.getElementById('current-path').innerText = ''
  document.getElementById('add-secret').style.display = 'none';
  resultList.textContent = '';
  notify.clear();
  const keywords = searchString.split(" ")
  const promises = []
  let matches = 0

  if (searchString.length !== 0) {
    for (const backend of currentBackends) {

      for (const keyword of keywords) {
        //Returns secrets by their name
        promises.push(async function () {
          let result
          try {
            result = await Vault.get(`/${backend}/search/${keyword}/?list=true`)
          } catch (e) { }

          return {
            data: result,
            backendName: backend
          }
        }())
      }
    }
    await Promise.all(promises).then((p) => {
      //Remove undefined values
      const found = p.flat().filter(i => i.data)
      for (const item of found) {
        for (const itemName of item.data.data.keys) {

          //if current element is a secret and its path includes all search keywords*
          if (keywords.every(k => itemName.toUpperCase().includes(k.toUpperCase()))) {
            if (itemName.charAt(itemName.length - 1) !== "/") {
              //Display a secret
              resultList.appendChild(displaySecret(`${item.backendName}${itemName}`));
            } else {
              //Display a directory
              resultList.appendChild(displayDirectory(`${item.backendName}${itemName}`, true));
            }
            matches++
          }
        }
      }

    }).catch((e) => {
      notify.error(chrome.i18n.getMessage("search_failure")+` ${e.message}`, {
        removeOption: true,
      });
    })
  }

  return matches !== 0;
}


async function fillCredentialsInBrowser(username, password) {
  notify.success(chrome.i18n.getMessage("copied_browser"),{
    time: 1000,
    removeOption: false
  });
  chrome.runtime.sendMessage({
    message: 'fill_creds',
    username: username,
    password: password,
    isUserTriggered: true,
  })

}

async function copyStringToClipboard(string) {
  notify.success(chrome.i18n.getMessage("copied_clipboard"),{
    time: 1000,
    removeOption: false
  });
  chrome.runtime.sendMessage({
    message: 'copy_to_clipboard',
    string: string,
    isUserTriggered: true,
  });
}

async function setCurrentPath(newPathName,ignoreError=false) {
  await browser.storage.local.set({ currentPath: newPathName });
  refreshExplorer(ignoreError)
}

async function resetSearch() {
  searchInput.value = ""
  await browser.storage.local.set({ currentPath: '' });
  refreshExplorer()
}

async function goUpDirectory() {
  const parentPath = currentPath.split("/").slice(0, -2).join("/")
  const newPath = (parentPath === '') ? '' : parentPath + '/'
  await browser.storage.local.set({ currentPath: newPath });
  refreshExplorer()
}

const searchHandler = async function (e) {
  if (e.key === 'Enter') {
    browser.storage.local.set({ inputValue: searchInput.value });
    const found = await searchSecrets(searchInput.value);
    if (!found){
      notify.info(chrome.i18n.getMessage("search_result_empty"), {
        removeOption: true,
      });
    }
  }
};
searchInput.addEventListener('keyup', searchHandler);


function getItemName(fullPathName) {
  const split = fullPathName.split("/")
  return (split[split.length - 1] === "") ? split[split.length - 2] : split[split.length - 1]
}

async function putSecret(data,editMode=false) {
  const hierarchy = currentPath.split("/")
  const backend = hierarchy[0]
  const backendPath = hierarchy.slice(1).join("/")

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    const tab = tabs[tabIndex];
    if (tab.url) {
      try {
        await Vault.request('PUT', `/${backend}/data/${backendPath}${data.secretName}`, {
          data: {
            value: data.secretValue
          }
        })

        if (editMode) {
          notify.success(chrome.i18n.getMessage("secret_updated"), {
            removeOption: false,
            time: 2000
          });
        }else{
          notify.success(chrome.i18n.getMessage("secret_added"), {
            removeOption: false,
            time: 2000
          });
        }


      } catch (e) {
        notify.clear().error(e.message);
      }
    }
  }
  refreshExplorer()
}