const DEFAULTS = {
  apiBase: 'https://tangible-basilisk-706.eu-west-1.convex.site',
  siteOrigin: 'https://wlink.vercel.app',
  token: '',
}

async function load() {
  const cfg = await chrome.storage.local.get(DEFAULTS)
  document.getElementById('token').value = cfg.token || ''
  document.getElementById('apiBase').value = cfg.apiBase || DEFAULTS.apiBase
  document.getElementById('siteOrigin').value = cfg.siteOrigin || DEFAULTS.siteOrigin
}

async function save() {
  await chrome.storage.local.set({
    token: document.getElementById('token').value.trim(),
    apiBase: document.getElementById('apiBase').value.trim().replace(/\/+$/, ''),
    siteOrigin: document.getElementById('siteOrigin').value.trim().replace(/\/+$/, ''),
  })
  const status = document.getElementById('status')
  status.textContent = 'Saved ✓'
  setTimeout(() => { status.textContent = '' }, 1500)
}

document.getElementById('save').addEventListener('click', save)
load()
