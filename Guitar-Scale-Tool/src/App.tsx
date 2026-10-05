/**
 * App.tsx
 *
 * Application entry point component for the Guitar Scale Tool.
 *
 * Responsibilities:
 *  - Initialises the Web Audio API engine on the first user interaction
 *    (click or keydown) to comply with browser autoplay policies.
 *  - Renders `<AppShell />` which owns the full layout: navigation bar,
 *    tab content routing, and the audio controls shelf overlay.
 *
 * The audio initialisation effect attaches one-time event listeners and
 * removes them after the first interaction fires to avoid memory leaks.
 */

import { useEffect } from 'react';
import { audioEngine } from './audio/AudioEngine';
import AppShell from './components/layout/AppShell';

/**
 * App
 *
 * Root React component.  Mounts the audio initialisation side-effect and
 * delegates all UI rendering to `<AppShell />`.
 *
 * @returns The top-level application element.
 */
function App() {
  // Initialise Web Audio on the first user gesture to satisfy browser
  // autoplay policies.  After the first gesture the listeners are removed
  // so this runs at most once per page load.
  useEffect(() => {
    const initAudio = () => {
      audioEngine.initialize();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <AppShell />
    </div>
  );
}

export default App;
