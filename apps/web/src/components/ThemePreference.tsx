import { useEffect } from 'react'
import { useTheme } from './themePreferenceState'

export function ThemePreference() {
  const theme = useTheme()
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme }
    apply()
    dark.addEventListener('change', apply)
    return () => dark.removeEventListener('change', apply)
  }, [theme])
  return null
}
