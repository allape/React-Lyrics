import { useProxy } from "@allape/use-loading";
import {
  KeyboardEvent,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { Region } from "wavesurfer.js/plugins/regions";
import { LyricsDriver, Millisecond, TimePoint } from "../../../index.ts";
import WaveForm, { IWaveFormProps } from "../Waveform";
import styles from "./style.module.scss";

export const GAP_FOR_MOUSE: Millisecond = 5;

export interface IRenderOptions {
  export?: () => void;
}

export interface ILyricsTimeLineProps {
  src?: string;
  lyrics?: string;
  /**
   * The threshold for merging syllables.
   */
  mergeableThreshold?: Millisecond;
  /**
   * line breaker width measured in milliseconds.
   */
  lineBreakerWidth?: Millisecond;
  options?: IWaveFormProps["options"];
  onRenderButton?: (options: IRenderOptions) => ReactNode;
  onExport?: (lyrics: string) => void;
}

export default function LyricsTimeLine({
  src,
  lyrics,
  mergeableThreshold = LyricsDriver.DEFAULT_SYLLABLE_MERGEABLE_GAP,
  lineBreakerWidth = 20,
  options: optionsFromProps,
  onRenderButton,
  onExport,
}: ILyricsTimeLineProps): ReactElement {
  const [regions, regionsRef, setRegions] = useProxy<
    Exclude<IWaveFormProps["regions"], undefined>
  >([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (mergeableThreshold && mergeableThreshold < 0) {
      console.warn("mergeableError should be greater than 0");
    }
  }, [mergeableThreshold]);

  useEffect(() => {
    if (!lyrics) return;

    const driver = LyricsDriver.parse(lyrics);
    driver.glueLine();

    const labels: IWaveFormProps["regions"] = [];
    let index = 0;

    driver.lines.forEach((line, li) => {
      line.syllables.forEach((syllable, si) => {
        const even = index++ % 2 === 0;
        labels.push({
          id: `syllable_${li}_${si}`,
          start: (syllable.st + GAP_FOR_MOUSE) / 1000,
          end: (syllable.et - GAP_FOR_MOUSE) / 1000,
          content: syllable.text,
          drag: true,
          resize: true,
          color: even ? "rgba(0, 0, 255, 0.2)" : "rgba(0, 255, 0, 0.2)",
          hoverColor: even ? "rgba(0, 0, 255, 0.5)" : "rgba(0, 255, 0, 0.5)",
        });
      });

      const lineBreakerSt: TimePoint = line.et + GAP_FOR_MOUSE * 2;
      labels.push({
        id: `newline_${li}`,
        start: lineBreakerSt / 1000,
        end: lineBreakerSt / 1000 + lineBreakerWidth / 1000,
        color: "rgba(255, 0, 0, 0.5)",
        hoverColor: "rgba(255, 0, 0, 1)",
        drag: true,
        resize: false,
      });
    });

    setRegions(labels);
  }, [lineBreakerWidth, lyrics, setRegions]);

  const handleExportRefinedLyrics = useCallback(() => {
    const lines: string[] = [];
    let line: string = "";

    regionsRef.current
      .sort((a, b) => a.start - b.start)
      .forEach((syllable, index, syllables) => {
        if (syllable.id?.startsWith("newline_")) {
          if (line) {
            lines.push(line);
            line = "";
          }
          return;
        }

        const nextSyllable = syllables[index + 1];

        const st: TimePoint = syllable.start * 1000;
        let et: TimePoint = (syllable.end || syllable.start + 0.5) * 1000;

        if (
          nextSyllable &&
          nextSyllable.id?.startsWith("syllable_") &&
          mergeableThreshold
        ) {
          const sst: TimePoint = nextSyllable.start * 1000;
          const diff = sst - et;
          if (Math.abs(diff) <= mergeableThreshold) {
            et += diff / 2;
            // data pollution
            syllable.end = et / 1000;
            nextSyllable.start = syllable.end;
          }
        }

        line += `${LyricsDriver.toStringTimePoint(st)}${syllable.content}${LyricsDriver.toStringTimePoint(et)}`;
      });

    if (line) {
      lines.push(line);
    }

    onExport?.(lines.join("\n"));
  }, [mergeableThreshold, onExport, regionsRef]);

  const handleRegionUpdate = useCallback(
    (region: Region) => {
      // pollute the region data, but NOT update the array address
      const found = regionsRef.current.find((i) => i.id === region.id);
      if (found) {
        found.start = region.start;
        found.end = region.end;
      }
    },
    [regionsRef],
  );

  const handleWaveFormInit = useCallback((ws: WaveSurfer) => {
    audioRef.current = ws.getMediaElement();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!audioRef.current) {
      return;
    }

    let seek: TimePoint = 0;

    switch (e.code) {
      case "Space":
        if (audioRef.current.paused) {
          audioRef.current.play().then();
        } else {
          audioRef.current.pause();
        }
        break;
      case "ArrowRight":
      case "KeyD":
        seek = 1000;
        break;
      case "ArrowLeft":
      case "KeyA":
        seek = -1000;
        break;
      case "ArrowDown":
      case "KeyS":
        seek = 3000;
        break;
      case "ArrowUp":
      case "KeyW":
        seek = -3000;
        break;
    }

    if (seek) {
      audioRef.current.currentTime += seek / 1000;
    }
  }, []);

  const options = useMemo<Exclude<IWaveFormProps["options"], undefined>>(
    () => ({
      height: 300,
      hideScrollbar: true,
      minPxPerSec: 250,
      ...optionsFromProps,
    }),
    [optionsFromProps],
  );

  return (
    <div
      className={styles.wrapper}
      tabIndex={0}
      onKeyDownCapture={handleKeyDown}
    >
      <WaveForm
        url={src}
        regions={regions}
        spectrogram={false}
        hover={false}
        options={options}
        onAudioLoaded={handleWaveFormInit}
        onRegionUpdated={handleRegionUpdate}
      />
      {onRenderButton?.({ export: handleExportRefinedLyrics }) || (
        <button className={styles.button} onClick={handleExportRefinedLyrics}>
          Export Refined Lyrics
        </button>
      )}
    </div>
  );
}
