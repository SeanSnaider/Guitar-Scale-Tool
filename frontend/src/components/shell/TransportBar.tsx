import { useRef } from 'react';
import { Play, SlidersHorizontal, Square } from 'lucide-react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { SCALES, spellScale } from '../../data/musicTheory';
import { Button, Select, Switch, cn } from '../../ui';
import { useScalePlayback } from '../../practice/useScalePlayback';
import { useScalePattern } from '../../practice/useScalePattern';
import { useMetronomeBridge } from '../../practice/useMetronomeBridge';
import { TempoStepper } from './TempoStepper';
import { SoundPanel } from './SoundPanel';

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '5/4', '7/8'].map((v) => ({ value: v, label: v }));

/**
 * TransportBar
 *
 * The one place for sound: play/stop the scale, tempo, meter, metronome and
 * its beat, and the sound settings popover. Fixed to the bottom of the work
 * area on every view (above the tab bar on phones). It mounts the app's
 * playback and metronome engines, so it must render exactly once.
 */
export function TransportBar() {
  const isPlaying = useGuitarStore((s) => s.isPlayingScale);
  const root = useGuitarStore((s) => s.selectedRoot);
  const scaleKey = useGuitarStore((s) => s.selectedScale);
  const direction = useGuitarStore((s) => s.playbackDirection);
  const metronome = useGuitarStore((s) => s.metronome);
  const setMetronome = useGuitarStore((s) => s.setMetronome);
  const toggleMetronome = useGuitarStore((s) => s.toggleMetronome);
  const soundOpen = useGuitarStore((s) => s.isAudioShelfOpen);
  const setSoundOpen = useGuitarStore((s) => s.setIsAudioShelfOpen);

  const { toggle } = useScalePlayback();
  const { pattern } = useScalePattern();
  const beat = useMetronomeBridge();
  const settingsRef = useRef<HTMLButtonElement>(null);

  const [beats] = metronome.timeSignature;
  const scaleName = SCALES[scaleKey]?.name ?? scaleKey;

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 border-t border-line bg-surface',
        'bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[env(safe-area-inset-bottom)]',
        'lg:left-[var(--rail-w)]',
      )}
    >
      <div className="relative flex h-[var(--transport-h)] items-center gap-2 px-[var(--gutter)] sm:gap-3 md:gap-5">
        <Button
          variant="primary"
          size="lg"
          icon={isPlaying ? Square : Play}
          onClick={toggle}
          aria-keyshortcuts="Space"
          title="Play or stop the scale (Space)"
          className="px-4 max-sm:h-10 max-[399px]:px-3"
        >
          {/* Below 400px only the icon shows; the text stays the accessible name */}
          <span className="max-[399px]:sr-only">
            {isPlaying ? 'Stop' : (
              <>
                Play<span className="max-sm:sr-only"> scale</span>
              </>
            )}
          </span>
        </Button>

        <div className="hidden min-w-0 flex-col leading-tight xl:flex">
          <span className="truncate text-[13px] font-bold">
            {spellScale(root, scaleKey)[0] ?? root} {scaleName}
          </span>
          <span className="text-xs text-muted">
            {pattern.length} notes · {direction}
          </span>
        </div>

        <span aria-hidden="true" className="hidden h-8 w-px bg-line md:block" />

        <TempoStepper bpm={metronome.bpm} onChange={(bpm) => setMetronome({ bpm })} />

        <Select
          label="Time signature"
          hideLabel
          size="sm"
          value={`${metronome.timeSignature[0]}/${metronome.timeSignature[1]}`}
          onChange={(v) => {
            const [n, d] = v.split('/').map(Number);
            setMetronome({ timeSignature: [n, d] as [number, number] });
          }}
          options={TIME_SIGNATURES}
          className="hidden w-[76px] md:flex"
          selectClassName="font-mono"
        />

        <Switch
          label="Metronome"
          visibleLabel={
            <>
              <span className="sm:hidden">Click</span>
              <span className="max-sm:hidden">Metronome</span>
            </>
          }
          checked={metronome.isPlaying}
          onChange={toggleMetronome}
        />

        {/* Beat indicator: the downbeat is ink, the sounding beat ticks */}
        <div aria-hidden="true" className="ml-auto hidden items-center gap-1.5 sm:flex">
          {Array.from({ length: beats }, (_, i) => (
            <span
              key={`${i}-${beat === i ? beat : 'x'}`}
              className={cn(
                'h-2 w-2 rounded-full transition-colors duration-100',
                beat === i ? 'beat-tick animate-[beat-tick_180ms_ease-out] bg-ink' : i === 0 ? 'bg-control' : 'bg-line-strong',
              )}
            />
          ))}
        </div>

        <div className="relative ml-auto sm:ml-0">
          <Button
            ref={settingsRef}
            variant="ghost"
            iconOnly
            icon={SlidersHorizontal}
            aria-label="Sound settings"
            aria-haspopup="dialog"
            aria-expanded={soundOpen}
            aria-controls={soundOpen ? 'sound-panel' : undefined}
            onClick={() => setSoundOpen(!soundOpen)}
          />
          <SoundPanel anchorRef={settingsRef} />
        </div>
      </div>
    </div>
  );
}
