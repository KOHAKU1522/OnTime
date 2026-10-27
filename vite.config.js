import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { assertFirebaseConfig } from './src/utils/firebaseConfig.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  assertFirebaseConfig(loadEnv(mode, '.', 'VITE_'))
  return { plugins: [react()] }
})
