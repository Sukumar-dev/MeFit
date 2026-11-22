import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const eventName = 'mefit-theme-change'

function current(): Theme {
  const value = localStorage.getItem('mefit-theme')
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function setTheme(theme: Theme) {
  localStorage.setItem('mefit-theme', theme)
  window.dispatchEvent(new Event(eventName))
}

export function useTheme() {
  const [theme, setValue] = useState(current)
  useEffect(() => {
    const sync = () => setValue(current())
    window.addEventListener(eventName, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(eventName, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return theme
}
