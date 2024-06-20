# Vault browser extension
A firefox/chrome web extension for managing Hashicorp Vault secrets

## Server requirement
This extension implements a recursive search feature that requires a Vault instance from the following fork: https://github.com/kosmos-education/vault

## Available authentication methods

| Backend |
|:--------|
| `LDAP`  | 

## Developing the extension

### Packaging

```
cp manifests/manifest-<browser>.json ./manifest.json
zip -r -FS ./vault.zip * --exclude '*.git*'
```
