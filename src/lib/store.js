export function normalizeUrl(input) {
  if (!/^https?:\/\//i.test(input)) return `https://${input}`
  return input
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomSlug(len = 6) {
  return Array.from({ length: len }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
}
