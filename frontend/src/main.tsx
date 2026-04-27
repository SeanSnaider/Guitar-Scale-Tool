/**
 * MAIN.TSX - THE APPLICATION ENTRY POINT
 * =======================================
 *
 * This is where React "mounts" to the DOM (the actual HTML page).
 *
 * HOW REACT WORKS AT A HIGH LEVEL:
 * --------------------------------
 * 1. index.html has a <div id="root"></div>
 * 2. This file finds that div and tells React to render our App inside it
 * 3. React then manages that entire subtree of the DOM
 *
 * StrictMode:
 * - A development tool that highlights potential problems
 * - Runs certain checks twice to catch bugs
 * - Has no effect in production builds
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
