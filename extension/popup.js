const DEFAULTS = {
  apiBase: 'https://tangible-basilisk-706.eu-west-1.convex.site',
  siteOrigin: 'https://wlink.vercel.app',
  token: '',
}

let currentUrl = ''
let lastShort = ''

function el(id) {
  return document.getElementById(id)
}

function setMsg(text, kind) {
  const m = el('msg')
  m.textContent = text
  m.className = kind || ''
}

async function config() {
  const stored = await chrome.storage.local.get(DEFAULTS)
  return {
    apiBase: (stored.apiBase || DEFAULTS.apiBase).replace(/\/+$/, ''),
    siteOrigin: (stored.siteOrigin || DEFAULTS.siteOrigin).replace(/\/+$/, ''),
    token: stored.token || '',
  }
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url || ''
  if (/^(https?|file):/.test(url)) {
    currentUrl = url
    el('url').textContent = url
    el('url').title = url
  } else {
    currentUrl = ''
    el('url').textContent = 'This page cannot be shortened (chrome:// etc.)'
    el('shorten').disabled = true
  }
}

async function shorten() {
  const { apiBase, siteOrigin, token } = await config()
  if (!token) {
    setMsg('No token set. Open Settings and paste your wlink extension token.', 'error')
    return
  }
  if (!currentUrl) return
  el('shorten').disabled = true
  el('shorten').textContent = 'Shortening…'
  setMsg('')
  try {
    const res = await fetch(`${apiBase}/api/ext/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: currentUrl, title: tabTitleCache || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Request failed (${res.status})`)
    }
    lastShort = `${siteOrigin}/${data.slug}`
    el('short-url').textContent = lastShort
    el('short-url').title = lastShort
    el('result').style.display = 'block'
    setMsg('Created!', 'ok')
  } catch (err) {
    setMsg(err?.message || 'Could not shorten link.', 'error')
  } finally {
    el('shorten').disabled = false
    el('shorten').textContent = 'Shorten this page ✨'
  }
}

let tabTitleCache = ''

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  tabTitleCache = tab?.title || ''
  await loadTab()
  el('shorten').addEventListener('click', shorten)
  el('copy').addEventListener('click', async () => {
    if (!lastShort) return
    await navigator.clipboard.writeText(lastShort)
    el('copy').textContent = 'Copied ✓'
    setTimeout(() => { el('copy').textContent = 'Copy' }, 1200)
  })
  el('qr').addEventListener('click', () => {
    if (lastShort) chrome.tabs.create({ url: `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(lastShort)}` })
  })
  el('short-url').addEventListener('click', () => {
    if (lastShort) chrome.tabs.create({ url: lastShort })
  })
  el('options-link').addEventListener('click', (e) => {
    e.preventDefault()
    chrome.runtime.openOptionsPage()
  })
}

init()
