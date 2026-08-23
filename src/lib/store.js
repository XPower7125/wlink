export function normalizeUrl(input) {
  if (!/^https?:\/\//i.test(input)) return `https://${input}`
  return input
}

// F4 fix: crypto-grade randomness (Math.random is xorshift128+ — predictable).
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomSlug(len = 6) {
  const bytes = new Uint32Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

// F1c companion helper: reject unsafe destination schemes before they
// reach the DB or window.location (defense in depth for Redirector).
export function isSafeHttpUrl(value) {
  try {
    const u = new URL(normalizeUrl(String(value || '')))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
