import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource-variable/inter'
import './styles/index.css'
import { App } from './app/App'
import { installPointerEffects } from './ui/motion'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

installPointerEffects()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
