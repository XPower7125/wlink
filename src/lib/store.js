import { useState } from 'react'

export function loadLinks() {
  try {
    return JSON.parse(localStorage.getItem('wlink:links')) ?? seed()
  } catch {
    return seed()
  }
}

function seed() {
  const demo = [
    {
      id: '1',
      slug: 'discord',
      url: 'https://discord.com',
      title: 'Join our Discord',
      description: 'The official community server. Talk, share and get support.',
      icon: '🎮',
      clicks: 128420,
      sponsored: false,
    },
    {
      id: '2',
      slug: 'docs',
      url: 'https://example.com/docs',
      title: 'Developer Docs',
      description: 'Everything you need to integrate the wlink API in minutes.',
      icon: '📚',
      clicks: 84110,
      sponsored: false,
    },
    {
      id: '3',
      slug: 'sponsor',
      url: 'https://example.com',
      title: 'Your Ad Here',
      description: 'Reach thousands of developers every single day.',
      icon: '🚀',
      clicks: 0,
      sponsored: true,
    },
  ]
  localStorage.setItem('wlink:links', JSON.stringify(demo))
  return demo
}

export function saveLinks(links) {
  localStorage.setItem('wlink:links', JSON.stringify(links))
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomSlug(len = 6) {
  return Array.from({ length: len }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
}

export function normalizeUrl(input) {
  if (!/^https?:\/\//i.test(input)) return `https://${input}`
  return input
}

export function useLinks() {
  const [links, setLinks] = useState(loadLinks)

  const addLink = (link) => {
    setLinks((prev) => {
      const next = [link, ...prev]
      saveLinks(next)
      return next
    })
  }

  return { links, addLink }
}
