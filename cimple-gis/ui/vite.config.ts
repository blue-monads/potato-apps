import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig(({ mode }) => {  
  return {
    base: '/zz/space/cimple-gis/',
    plugins: [
      react()
    ]
  }
})
