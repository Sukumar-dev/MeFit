// The public Vercel hostname forwards /api to Render on the same browser origin.
export const apiUrl = globalThis.location?.hostname === 'mefit-fitness-planner.vercel.app'
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api')
