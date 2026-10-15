import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useGuitarStore } from '../../store/useGuitarStore';
import { Button, Slider, Switch } from '../../ui';
import { MAX_BPM, MIN_BPM } from './TempoStepper';

/**
 * SoundPanel
 *
 * The transport's settings popover: tempo slider for big jumps, volumes,
 * sustain and the accented downbeat. Non-modal: it opens above the settings
 * button, moves focus inside, and closes on Escape, an outside click, or the
 * close button, returning focus to the button that opened it.
 */
export function SoundPanel({ anchorRef }: { anchorRef: React.RefObject<HTMLButtonElement | null> }) {
  const open = useGuitarStore((s) => s.isAudioShelfOpen);
  const setOpen = useGuitarStore((s) => s.setIsAudioShelfOpen);
  const metronome = useGuitarStore((s) => s.metronome);
  const setMetronome = useGuitarStore((s) => s.setMetronome);
  const audio = useGuitarStore((s) => s.audioSettings);
  const setAudio = useGuitarStore((s) => s.setAudioSettings);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const anchor = anchorRef.current;
    const close = () => {
      setOpen(false);
      anchor?.focus();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchor?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, setOpen, anchorRef]);

  if (!open) return null;


  return (
    <div
      ref={panelRef}
      id="sound-panel"
      role="dialog"
      aria-label="Sound settings"
      tabIndex={-1}
      className="motion-slide absolute right-0 bottom-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-32px))] animate-[rise-in_160ms_cubic-bezier(0.16,1,0.3,1)] rounded-panel border border-control bg-surface p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Sound</h2>
        <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close sound settings" onClick={() => setOpen(false)} />
      </div>
      <div className="flex flex-col gap-4">
        <Slider
          label="Tempo"
          min={MIN_BPM}
          max={MAX_BPM}
          value={metronome.bpm}
          onChange={(bpm) => setMetronome({ bpm })}
          format={(v) => `${v} BPM`}
        />
        <Slider label="Master volume" min={0} max={100} value={Math.round(audio.masterVolume * 100)} onChange={(v) => setAudio({ masterVolume: v / 100 })} format={(v) => `${v}%`} />
        <Slider label="Note volume" min={0} max={100} value={Math.round(audio.noteVolume * 100)} onChange={(v) => setAudio({ noteVolume: v / 100 })} format={(v) => `${v}%`} />
        <Slider label="Metronome volume" min={0} max={100} value={Math.round(audio.metronomeVolume * 100)} onChange={(v) => setAudio({ metronomeVolume: v / 100 })} format={(v) => `${v}%`} />
        <Slider
          label="Note sustain"
          min={1}
          max={50}
          value={Math.round(audio.sustainLength * 10)}
          onChange={(v) => setAudio({ sustainLength: v / 10 })}
          format={(v) => `${(v / 10).toFixed(1)} s`}
          valueText={(v) => `${(v / 10).toFixed(1)} seconds`}
        />
        <Switch label="Accent the first beat" checked={metronome.accentFirst} onChange={(accentFirst) => setMetronome({ accentFirst })} />
      </div>
    </div>
  );
}
