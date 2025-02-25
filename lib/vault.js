
class Vault {
  constructor() {
    this.token = null;
    this.address = null;
    this.base = null
    this.clientid = null
  }

  async load() {
    this.token = (await browser.storage.local.get('vaultToken')).vaultToken;
    this.address = (await browser.storage.local.get('vaultAddress')).vaultAddress;
    this.base = `${this.address}/v1`;
  }

  //Check token validity
  async isLoggedIn(){
    if (!this.address){
      return false
    }
    const res = await fetch(this.base + '/auth/token/lookup-self', {
      method: 'GET',
      headers: {
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json',
      }
    });

    return res.ok
  }

  async setAddress(address) {
    this.address = address
    this.base = `${address}/v1`;
    await browser.storage.local.set({ vaultAddress: address });
  }

  async setToken(token) {
    this.token = token
    await browser.storage.local.set({ vaultToken: token });
  }

  async login(authMount, credentials) {
      const apiResponse = await this.request('POST', `/auth/${authMount}/login/${credentials.username}`, { password: credentials.password })
      const authInfo = apiResponse.auth;
      const token = authInfo.client_token;
      await this.setToken(token)
      browser.runtime.sendMessage({
        message: 'auto_renew_token',
      });

      // If token expires in less than 24 hour, try to extend it to avoid having to re-logon too often
      if (authInfo.lease_duration < 86400) {
        await this.request('POST', `/auth/token/renew-self`, { increment: '24h' })
      }
  }

  async logout(){
    if (this.token) {
      await this.request('POST', `/auth/token/revoke-self`, {
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json'
      })
    }
    await browser.storage.local.clear();
  }

  async request(method, endpoint, content = null) {
    const res = await fetch(this.base + endpoint, {
      method: method.toUpperCase(),
      headers: {
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: content != null ? JSON.stringify(content) : null,
    });

    if (!res.ok)
      throw new Error(
        `${method.toUpperCase()} ${this.base
        }${endpoint} (HTTP ${res.status})`
      );

    try{
      return await res.json();
    }catch (_) {
      return {}
    }

  }

  list(endpoint) {
    return this.request('LIST', endpoint);
  }

  get(endpoint) {
    return this.request('GET', endpoint);
  }

  post(endpoint, content) {
    return this.request('POST', endpoint, content);
  }

  async del(endpoint) {
    const res = await fetch(this.base + endpoint, {
      method: 'DELETE',
      headers: {
        'X-Vault-Token': this.token
      }
    });

    if (!res.ok)
      throw new Error(
        `DELETE ${this.base
        }${endpoint} (HTTP ${res.status})`
      );

  }
}
const vault = new Vault()
export default vault
