import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import '@fontsource-variable/inter'
import './styles/index.css'
import { App } from './app/App'
import { installGlassLens, installPointerEffects } from './ui/motion'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

installPointerEffects()
installGlassLens()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
