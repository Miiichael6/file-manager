import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useT } from "../../../../shared/i18n/index";
import "./info-video.css";

/*
 * MI-FORK: reproductor del panel de información. Controles propios en lugar
 * de los nativos de <video> (en 240 px de ancho apenas caben): barra de tiempo
 * con lo ya cargado, ±10 s, velocidad, repetir, volumen con la rueda, imagen
 * en imagen y pantalla completa. Atajos con el foco en el reproductor:
 * Espacio/K, ←/→ (5 s), J/L (10 s), ↑/↓ volumen, M, F, , y . (velocidad).
 * Volumen y velocidad se recuerdan entre videos (localStorage, solo comodidad).
 */

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const VOLUME_KEY = "mi-player-volume";
const MUTED_KEY = "mi-player-muted";
const SPEED_KEY = "mi-player-speed";

function readNumber(key: string, fallback: number): number {
  try {
    const value = Number.parseFloat(localStorage.getItem(key) ?? "");
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento simplemente no se recuerda.
  }
}

/** 75 s → 1:15, 3725 s → 1:02:05 */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

type Props = {
  path: string;
  /** Proporción del video ("1920 / 1080"): la caja la tiene desde el primer
   *  fotograma, sin esperar a los metadatos (si no, <video> mide 150 px de alto
   *  y la caja crece un momento). */
  ratio: string;
  /** Miniatura encima hasta que hay imagen — sin destello negro. */
  cover: ReactNode;
  /** Audio: la carátula se queda arriba y los controles fijos debajo
   *  (sin pantalla completa ni imagen en imagen). */
  audio?: boolean;
};

export function InfoVideoPlayer({ path, ratio, cover, audio = false }: Props) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  /** Primer fotograma decodificado: fuera la miniatura, dentro los controles. */
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => Math.min(1, Math.max(0, readNumber(VOLUME_KEY, 1))));
  const [muted, setMuted] = useState(() => readNumber(MUTED_KEY, 0) === 1);
  const [speed, setSpeed] = useState(() => (SPEEDS.includes(readNumber(SPEED_KEY, 1)) ? readNumber(SPEED_KEY, 1) : 1));
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  /** Aviso breve en el centro (volumen, velocidad, ±10 s). */
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  /** Actividad reciente (ratón, teclado): los controles se ven 2 s más. */
  const [awake, setAwake] = useState(true);
  const awakeTimer = useRef<number | undefined>(undefined);
  const wake = useCallback(() => {
    setAwake(true);
    window.clearTimeout(awakeTimer.current);
    awakeTimer.current = window.setTimeout(() => setAwake(false), 2000);
  }, []);
  useEffect(() => () => window.clearTimeout(awakeTimer.current), []);
  /** Arrastrando la barra de tiempo — timeupdate no debe mover el control. */
  const seeking = useRef(false);

  const showFlash = useCallback((text: string) => {
    setFlash(text);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 700);
  }, []);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // El estado manda; el elemento se sincroniza.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    write(VOLUME_KEY, String(volume));
    write(MUTED_KEY, muted ? "1" : "0");
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
    write(SPEED_KEY, String(speed));
  }, [speed]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration || 0);
      setTime(video.currentTime);
      showFlash(`${delta > 0 ? "+" : "−"}${Math.abs(delta)} s`);
    },
    [showFlash],
  );

  const changeVolume = useCallback(
    (delta: number) => {
      setMuted(false);
      setVolume((current) => {
        const next = Math.round(Math.min(1, Math.max(0, current + delta)) * 100) / 100;
        showFlash(`${Math.round(next * 100)} %`);
        return next;
      });
    },
    [showFlash],
  );

  const changeSpeed = useCallback(
    (step: number) => {
      setSpeed((current) => {
        const index = SPEEDS.indexOf(current);
        // Clic en el botón da la vuelta; las teclas se paran en los extremos.
        const next =
          step === 0
            ? SPEEDS[(index + 1) % SPEEDS.length]
            : SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, index + step))];
        showFlash(`${next}×`);
        return next;
      });
    },
    [showFlash],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void boxRef.current?.requestFullscreen().catch(() => undefined);
  }, []);

  const togglePip = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
    else void video.requestPictureInPicture().catch(() => undefined);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    wake();
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    // El control deslizante maneja sus propias flechas.
    if ((event.target as HTMLElement).tagName === "INPUT" && event.key.startsWith("Arrow")) {
      event.stopPropagation();
      return;
    }
    const handlers: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      ArrowLeft: () => skip(-5),
      ArrowRight: () => skip(5),
      j: () => skip(-10),
      l: () => skip(10),
      ArrowUp: () => changeVolume(0.05),
      ArrowDown: () => changeVolume(-0.05),
      m: () => setMuted((value) => !value),
      ...(audio ? {} : { f: toggleFullscreen }),
      ",": () => changeSpeed(-1),
      ".": () => changeSpeed(1),
    };
    const handler = handlers[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!handler) return;
    // La lista no debe recibir las teclas (Espacio = vista previa, flechas = selección).
    event.preventDefault();
    event.stopPropagation();
    handler();
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;
  const loaded = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const pipSupported = !audio && typeof document !== "undefined" && document.pictureInPictureEnabled;

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={wake}
      onMouseLeave={() => setAwake(false)}
      className={`mi-player ${playing ? "is-playing" : "is-paused"} ${awake ? "is-awake" : ""} ${
        fullscreen ? "is-fullscreen" : ""
      } ${ready ? "" : "is-loading"} ${audio ? "is-audio" : ""}`}
      style={fullscreen || audio ? undefined : { aspectRatio: ratio }}
    >
      <video
        ref={videoRef}
        src={convertFileSrc(path)}
        autoPlay
        loop={loop}
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onWheel={(event) => changeVolume(event.deltaY < 0 ? 0.05 : -0.05)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          video.volume = volume;
          video.muted = muted;
          video.playbackRate = speed;
          setDuration(video.duration);
          // El foco al reproductor: los atajos funcionan sin otro clic.
          boxRef.current?.focus({ preventScroll: true });
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          if (!seeking.current) setTime(event.currentTarget.currentTime);
        }}
        onLoadedData={() => setReady(true)}
        onProgress={(event) => {
          const ranges = event.currentTarget.buffered;
          if (ranges.length > 0) setBuffered(ranges.end(ranges.length - 1));
        }}
      />

      {(audio || !ready) && (
        <div aria-hidden className="mi-player-cover" onClick={audio ? toggle : undefined}>
          {cover}
        </div>
      )}

      {flash !== null && <span className="mi-player-flash">{flash}</span>}

      <div className="mi-player-controls" onDoubleClick={(event) => event.stopPropagation()}>
        <div className="mi-player-timeline">
          <span className="mi-player-time">{clock(time)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            aria-label={t("player.seek")}
            className="mi-player-range"
            style={{ "--progress": `${progress}%`, "--loaded": `${loaded}%` } as React.CSSProperties}
            onPointerDown={() => {
              seeking.current = true;
            }}
            onPointerUp={() => {
              seeking.current = false;
            }}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              setTime(value);
              if (videoRef.current) videoRef.current.currentTime = value;
            }}
          />
          <span className="mi-player-time">{clock(duration)}</span>
        </div>

        <div className="mi-player-buttons">
          <PlayerButton label={playing ? t("player.pause") : t("player.play")} onClick={toggle}>
            {playing ? (
              <Pause size={15} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={15} fill="currentColor" strokeWidth={0} />
            )}
          </PlayerButton>
          <PlayerButton label={t("player.back10")} onClick={() => skip(-10)}>
            <RotateCcw size={14} />
          </PlayerButton>
          <PlayerButton label={t("player.forward10")} onClick={() => skip(10)}>
            <RotateCw size={14} />
          </PlayerButton>
          <span className="flex-1" />
          <button
            type="button"
            className="mi-player-speed"
            aria-label={t("player.speed")}
            data-tooltip={t("player.speed")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => changeSpeed(0)}
          >
            {speed}×
          </button>
          <PlayerButton label={t("player.loop")} pressed={loop} onClick={() => setLoop((value) => !value)}>
            <Repeat size={14} />
          </PlayerButton>
          <PlayerButton
            label={muted ? t("player.unmute") : t("player.mute")}
            onClick={() => setMuted((value) => !value)}
            onWheel={(delta) => changeVolume(delta)}
          >
            <VolumeIcon size={15} />
          </PlayerButton>
          {pipSupported && (
            <PlayerButton label={t("player.pip")} onClick={togglePip}>
              <PictureInPicture2 size={14} />
            </PlayerButton>
          )}
          {!audio && (
            <PlayerButton
              label={fullscreen ? t("player.exitFullscreen") : t("player.fullscreen")}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </PlayerButton>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerButton({
  label,
  pressed,
  onClick,
  onWheel,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  /** Rueda sobre el botón (volumen): delta positivo = más. */
  onWheel?: (delta: number) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={label}
      className={`mi-player-button ${pressed ? "is-on" : ""}`}
      // El foco se queda en el reproductor (atajos).
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      onWheel={onWheel ? (event) => onWheel(event.deltaY < 0 ? 0.05 : -0.05) : undefined}
    >
      {children}
    </button>
  );
}
