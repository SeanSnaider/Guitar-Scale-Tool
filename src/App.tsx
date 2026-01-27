import { useEffect, useState } from 'react';
import { useGuitarStore } from './store/useGuitarStore';
import { audioEngine } from './audio/AudioEngine';
import Fretboard from './components/Fretboard';
import Tablature from './components/Tablature';
import Controls from './components/Controls';
import ChordDiagrams from './components/ChordDiagrams';
import PracticeMode from './components/PracticeMode';
import CollapsiblePanel from './components/CollapsiblePanel';

type ActiveTab = 'fretboard' | 'chords' | 'practice';

function App() {
  const { theme } = useGuitarStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('fretboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Initialize audio engine on first user interaction
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>

              <div>
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
                  Guitar Scale Tool
                </h1>
                <p className="text-[10px] sm:text-xs text-[var(--text-muted)] hidden sm:block">
                  Learn scales, master positions, track progress
                </p>
              </div>
            </div>

            {/* Tab Navigation - Desktop */}
            <nav className="hidden md:flex items-center gap-1 bg-[var(--border)] rounded-lg p-0.5">
              {([
                { id: 'fretboard', label: 'Fretboard', icon: '🎸' },
                { id: 'chords', label: 'Chords', icon: '🎵' },
                { id: 'practice', label: 'Practice', icon: '📝' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
                    activeTab === tab.id
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>

            <ThemeToggle />
          </div>

          {/* Mobile Tab Navigation */}
          <nav className="flex md:hidden items-center gap-1 mt-2 bg-[var(--border)] rounded-lg p-0.5">
            {([
              { id: 'fretboard', label: 'Fretboard', icon: '🎸' },
              { id: 'chords', label: 'Chords', icon: '🎵' },
              { id: 'practice', label: 'Practice', icon: '📝' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                  activeTab === tab.id
                    ? 'bg-[var(--primary)] text-[var(--bg)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-2 sm:px-4 py-3 sm:py-4 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Left Sidebar - Scale/Root Selection Only */}
          <aside className={`lg:col-span-2 space-y-3 ${isMobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
            <CollapsiblePanel title="Scale Selection" defaultOpen={true}>
              <Controls />
            </CollapsiblePanel>
          </aside>

          {/* Center Content Area */}
          <section className="lg:col-span-8 space-y-3 sm:space-y-4 min-w-0">
            {activeTab === 'fretboard' && (
              <>
                {/* Fretboard */}
                <div className="bg-[var(--surface)] rounded-lg p-2 sm:p-3 border border-[var(--border)] overflow-x-auto">
                  <Fretboard />
                </div>

                {/* Tablature - Directly Below Fretboard */}
                <Tablature />
              </>
            )}

            {activeTab === 'chords' && (
              <ChordDiagrams />
            )}

            {activeTab === 'practice' && (
              <>
                {/* Fretboard for practice mode interaction */}
                <div className="bg-[var(--surface)] rounded-lg p-2 sm:p-3 border border-[var(--border)] overflow-x-auto">
                  <Fretboard />
                </div>
                <PracticeMode />
              </>
            )}
          </section>

          {/* Right Sidebar - Audio + Metronome Only */}
          <aside className={`lg:col-span-2 space-y-3 ${isMobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
            <CollapsiblePanel title="Metronome" defaultOpen={true}>
              <MetronomeCompact />
            </CollapsiblePanel>

            <CollapsiblePanel title="Audio Controls" defaultOpen={true}>
              <AudioControlsCompact />
            </CollapsiblePanel>
          </aside>
        </div>
      </main>

      {/* Bottom Stats Bar */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <StatsBar />
        </div>
      </footer>
    </div>
  );
}

// Theme Toggle Component
function ThemeToggle() {
  const { theme, setTheme } = useGuitarStore();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-muted)] hidden sm:inline">Theme:</span>
      <div className="flex bg-[var(--border)] rounded-lg p-0.5">
        {(['system', 'light', 'dark'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              theme === t
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t === 'system' ? '🖥️' : t === 'light' ? '☀️' : '🌙'}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact Metronome for sidebar
function MetronomeCompact() {
  const { metronome, setMetronome, toggleMetronome } = useGuitarStore();

  return (
    <div className="space-y-3">
      {/* BPM Display & Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--text)]">{metronome.bpm}</div>
          <div className="text-[10px] text-[var(--text-muted)]">BPM</div>
        </div>
        <button
          onClick={toggleMetronome}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            metronome.isPlaying
              ? 'bg-[var(--secondary)] text-[var(--bg)]'
              : 'bg-[var(--primary)] text-[var(--bg)]'
          }`}
        >
          {metronome.isPlaying ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* BPM Slider */}
      <input
        type="range"
        min={20}
        max={300}
        value={metronome.bpm}
        onChange={e => setMetronome({ bpm: parseInt(e.target.value) })}
        className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer
                   accent-[var(--primary)]"
      />

      {/* Time Signature */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">Time:</span>
        <select
          value={`${metronome.timeSignature[0]}/${metronome.timeSignature[1]}`}
          onChange={e => {
            const [beats, note] = e.target.value.split('/').map(Number);
            setMetronome({ timeSignature: [beats, note] as [number, number] });
          }}
          className="px-2 py-1 bg-[var(--input)] border border-[var(--border)]
                     rounded text-[var(--text)] text-xs"
        >
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
          <option value="6/8">6/8</option>
          <option value="5/4">5/4</option>
        </select>
      </div>
    </div>
  );
}

// Compact Audio Controls for sidebar
function AudioControlsCompact() {
  const {
    audioSettings,
    setAudioSettings,
    playbackDirection,
    setPlaybackDirection,
  } = useGuitarStore();

  return (
    <div className="space-y-3">
      {/* Playback Direction */}
      <div className="flex gap-1">
        {(['ascending', 'descending', 'both'] as const).map(dir => (
          <button
            key={dir}
            onClick={() => setPlaybackDirection(dir)}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all capitalize
              ${playbackDirection === dir
                ? 'bg-[var(--primary)] text-[var(--bg)]'
                : 'bg-[var(--button)] text-[var(--text-muted)] hover:bg-[var(--button-hover)]'
              }`}
          >
            {dir === 'ascending' ? '↑' : dir === 'descending' ? '↓' : '↑↓'}
          </button>
        ))}
      </div>

      {/* Volume Controls */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
            <span>Master</span>
            <span>{Math.round(audioSettings.masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={audioSettings.masterVolume * 100}
            onChange={e => setAudioSettings({ masterVolume: parseInt(e.target.value) / 100 })}
            className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer
                       accent-[var(--primary)]"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
            <span>Notes</span>
            <span>{Math.round(audioSettings.noteVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={audioSettings.noteVolume * 100}
            onChange={e => setAudioSettings({ noteVolume: parseInt(e.target.value) / 100 })}
            className="w-full h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer
                       accent-[var(--primary)]"
          />
        </div>
      </div>
    </div>
  );
}

// Bottom Stats Bar Component
function StatsBar() {
  const { userStats } = useGuitarStore();

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
      {/* Level & XP */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--primary)] flex items-center justify-center
                        text-sm sm:text-lg font-bold text-[var(--bg)]">
          {userStats.level}
        </div>
        <div>
          <div className="text-[10px] sm:text-xs font-medium text-[var(--text)]">Level {userStats.level}</div>
          <div className="w-16 sm:w-24 h-1 sm:h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)]"
              style={{ width: `${(userStats.xp % 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats - Hide some on mobile */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="text-center">
          <div className="text-sm sm:text-lg font-bold text-[var(--text)]">🔥 {userStats.currentStreak}</div>
          <div className="text-[8px] sm:text-[10px] text-[var(--text-muted)]">Streak</div>
        </div>

        <div className="text-center hidden sm:block">
          <div className="text-lg font-bold text-[var(--text)]">🎵 {userStats.totalScalesLearned}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Scales</div>
        </div>

        <div className="text-center">
          <div className="text-sm sm:text-lg font-bold text-[var(--text)]">
            ⏱️ {Math.floor(userStats.totalPracticeMinutes / 60)}h
          </div>
          <div className="text-[8px] sm:text-[10px] text-[var(--text-muted)]">Practice</div>
        </div>

        <div className="text-center hidden sm:block">
          <div className="text-lg font-bold text-[var(--text)]">⭐ {userStats.longestStreak}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Best</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => useGuitarStore.getState().incrementStreak()}
          className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs bg-[var(--button)] text-[var(--text)]
                     rounded hover:bg-[var(--button-hover)] transition-colors"
        >
          Log Practice
        </button>
      </div>
    </div>
  );
}

export default App;
