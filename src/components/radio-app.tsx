import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AudioEngine } from "@/lib/audio-engine";
import { PRESET_NAMES, MilkVis } from "@/lib/visualizer";
import { STATIONS, proxyStreamUrl, type Station } from "@/lib/stations";
import { cn } from "@/lib/utils";

export function RadioApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef(new AudioEngine());
  const visRef = useRef<MilkVis | null>(null);
  const rafRef = useRef(0);
  const presetRef = useRef(0);
  const [station, setStation] = useState<Station>(STATIONS[0]!);
  const [custom, setCustom] = useState("");
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [preset, setPreset] = useState(0);
  const [fs, setFs] = useState(false);
  const [picker, setPicker] = useState(true);

  const loadStation = useCallback(async (next: Station, autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    setStation(next);
    setError(null);
    setStatus("Connecting");
    audio.crossOrigin = "anonymous";
    audio.src = proxyStreamUrl(next.url);
    audio.load();
    if (autoplay) {
      try {
        await engineRef.current.attach(audio);
        await audio.play();
        setPlaying(true);
        setStatus("Live");
      } catch {
        setPlaying(false);
        setStatus("Tap play");
        setError("Playback needs a tap — then it will start.");
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      visRef.current = new MilkVis(canvas);
    } catch {
      setError("This browser cannot draw WebGL visuals.");
      return;
    }
    const loop = (t: number) => {
      const vis = visRef.current;
      const canvasEl = canvasRef.current;
      if (!vis || !canvasEl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvasEl.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvasEl.clientHeight * dpr));
      if (canvasEl.width !== w || canvasEl.height !== h) {
        canvasEl.width = w;
        canvasEl.height = h;
      }
      const levels = engineRef.current.sample();
      vis.preset = presetRef.current;
      vis.frame(
        t * 0.001,
        engineRef.current.freq,
        levels.bass,
        levels.mid,
        levels.treb,
        levels.amp,
        w,
        h,
      );
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      visRef.current?.destroy();
      visRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlaying = () => {
      setPlaying(true);
      setStatus("Live");
      setError(null);
    };
    const onWait = () => setStatus("Buffering");
    const onErr = () => {
      setPlaying(false);
      setStatus("Error");
      setError("Could not reach that stream. Try another station or a direct MP3/AAC URL.");
    };
    const onPause = () => {
      if (!audio.ended) {
        setPlaying(false);
        setStatus((s) => (s === "Error" ? s : "Paused"));
      }
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWait);
    audio.addEventListener("error", onErr);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWait);
      audio.removeEventListener("error", onErr);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    if (playing) {
      audio.pause();
      setPlaying(false);
      setStatus("Paused");
      return;
    }
    if (!audio.src) await loadStation(station, false);
    try {
      await engineRef.current.attach(audio);
      await audio.play();
      setPlaying(true);
      setStatus("Live");
    } catch {
      setError("Tap play again to start audio.");
    }
  }

  async function toggleFullscreen() {
    const node = stageRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      setError("Fullscreen is blocked in this view. Try the dedicated button after a tap.");
    }
  }

  function cyclePreset(dir: number) {
    setPreset((p) => {
      const next = (p + dir + PRESET_NAMES.length) % PRESET_NAMES.length;
      presetRef.current = next;
      return next;
    });
  }

  function playCustom() {
    const url = custom.trim();
    if (!url) return;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad");
    } catch {
      setError("Enter a full http(s) stream URL.");
      return;
    }
    void loadStation({ id: "custom", name: "Custom stream", tag: url, url }, true);
  }

  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <audio ref={audioRef} playsInline preload="none" />
      <div ref={stageRef} className="relative min-h-dvh bg-bg">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onDoubleClick={() => void toggleFullscreen()}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.55)_0%,transparent_22%,transparent_62%,rgba(9,9,11,0.78)_100%)]" />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
          <div className="pointer-events-auto">
            <p className="font-display text-3xl font-medium tracking-[-0.03em] text-fg sm:text-4xl">
              Aether
            </p>
            <p className="mt-1 max-w-[16rem] text-sm text-muted">Live radio. Liquid light.</p>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-surface px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted shadow-[var(--shadow-border)] sm:inline-flex">
              {status}
            </span>
            <IconBtn label={fs ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
              {fs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </IconBtn>
          </div>
        </header>

        <div
          className={cn(
            "absolute inset-x-0 top-24 z-10 px-4 sm:px-8",
            fs && !picker ? "hidden" : "",
          )}
        >
          <div
            className={cn(
              "mx-auto max-w-xl overflow-hidden rounded-xl bg-surface/90 p-3 shadow-[var(--shadow-border)] backdrop-blur-sm transition-opacity duration-250",
              picker ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-subtle">Stations</p>
              <button
                type="button"
                className="text-xs text-muted hover:text-fg"
                onClick={() => setPicker(false)}
              >
                Hide
              </button>
            </div>
            <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {STATIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void loadStation(s, true)}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-md px-3 py-2 text-left transition-colors duration-150",
                    station.id === s.id
                      ? "bg-accent text-accent-fg"
                      : "bg-elevated text-fg hover:bg-elevated/80",
                  )}
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span
                    className={cn(
                      "text-xs",
                      station.id === s.id ? "text-accent-fg/70" : "text-subtle",
                    )}
                  >
                    {s.tag}
                  </span>
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                playCustom();
              }}
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Shoutcast / Icecast URL"
                className="h-11 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                className="h-11 rounded-md bg-fg px-4 text-sm font-medium text-bg"
              >
                Tune
              </button>
            </form>
          </div>
        </div>

        <footer className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
          <div className="mx-auto max-w-3xl rounded-xl bg-surface/92 p-3 shadow-[var(--shadow-border)] backdrop-blur-sm sm:p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void togglePlay()}
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-fg text-bg"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5 translate-x-px" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-medium tracking-[-0.02em]">
                  {station.name}
                </p>
                <p className="truncate text-xs text-muted">{station.tag}</p>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    setMuted(false);
                    setVolume(Number(e.target.value));
                  }}
                  className="w-24 accent-accent"
                  aria-label="Volume"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPicker((v) => !v)}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-elevated px-3 text-sm text-fg"
              >
                <Radio className="size-4 text-muted" />
                {picker ? "Hide list" : "Stations"}
              </button>
              <div className="inline-flex h-11 items-center rounded-md bg-elevated">
                <button
                  type="button"
                  className="flex size-11 items-center justify-center text-muted hover:text-fg"
                  onClick={() => cyclePreset(-1)}
                  aria-label="Previous visual"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="min-w-16 text-center text-sm tabular-nums text-fg">
                  {PRESET_NAMES[preset]}
                </span>
                <button
                  type="button"
                  className="flex size-11 items-center justify-center text-muted hover:text-fg"
                  onClick={() => cyclePreset(1)}
                  aria-label="Next visual"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <span className="ml-auto hidden text-xs text-subtle sm:inline">
                Double-tap vis for fullscreen
              </span>
            </div>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-md bg-surface text-fg shadow-[var(--shadow-border)]"
    >
      {children}
    </button>
  );
}
