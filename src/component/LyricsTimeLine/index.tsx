import { useProxy } from "@allape/use-loading";
import {
  ForwardedRef,
  forwardRef,
  KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { Region } from "wavesurfer.js/plugins/regions";
import { LyricsDriver, Millisecond, TimePoint } from "../../../index.ts";
import WaveForm, { IWaveFormProps } from "../Waveform";

export const GAP_FOR_MOUSE: Millisecond = 5;

export interface ILyricsTimeLineRef {
  handleExport: () => Promise<string>;
}

export interface ILyricsTimeLineProps {
  src?: string;
  lyrics?: string;
  editable?: boolean;
  styleOfSyllable?: string;
  /**
   * The threshold for merging syllables.
   */
  mergeableThreshold?: Millisecond;
  /**
   * line breaker width measured in milliseconds.
   */
  lineBreakerWidth?: Millisecond;
  options?: IWaveFormProps["options"];
  onExport?: (lyrics: string) => Promise<string> | string | void;
}

function LyricsTimeLine(
  {
    src,
    lyrics,
    editable = true,
    styleOfSyllable = "",
    mergeableThreshold = LyricsDriver.DEFAULT_SYLLABLE_MERGEABLE_GAP,
    lineBreakerWidth = 20,
    options: optionsFromProps,
    onExport,
  }: ILyricsTimeLineProps,
  ref: ForwardedRef<ILyricsTimeLineRef>,
): ReactElement {
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

    const gapForMouse = editable ? GAP_FOR_MOUSE : 0;

    driver.lines.forEach((line, li) => {
      line.syllables.forEach((syllable, si) => {
        const even = editable ? index++ % 2 === 0 : true;
        const div = document.createElement("div");
        div.innerText = syllable.text;
        div.style = styleOfSyllable;

        const activeColor = even
          ? "rgba(0, 0, 255, 0.5)"
          : "rgba(0, 255, 0, 0.5)";

        labels.push({
          id: `syllable_${li}_${si}`,
          start: (syllable.st + gapForMouse) / 1000,
          end: (syllable.et - gapForMouse) / 1000,
          content: div,
          drag: editable,
          resize: editable,
          color: even ? "rgba(0, 0, 255, 0.2)" : "rgba(0, 255, 0, 0.2)",
          hoverColor: editable ? activeColor : undefined,
          activeColor,
        });
      });

      if (editable) {
        const lineBreakerSt: TimePoint = line.et + gapForMouse * 2;
        labels.push({
          id: `newline_${li}`,
          start: lineBreakerSt / 1000,
          end: lineBreakerSt / 1000 + lineBreakerWidth / 1000,
          color: "rgba(255, 0, 0, 0.5)",
          hoverColor: "rgba(255, 0, 0, 1)",
          drag: true,
          resize: false,
        });
      }
    });

    setRegions(labels);
  }, [editable, lineBreakerWidth, lyrics, setRegions, styleOfSyllable]);

  const handleExport = useCallback(async () => {
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

        let text = "";
        if (syllable.content instanceof HTMLElement) {
          text = syllable.content.innerText;
        } else if (typeof syllable.content === "string") {
          text = syllable.content;
        }

        line += `${LyricsDriver.toStringTimePoint(st)}${text}${LyricsDriver.toStringTimePoint(et)}`;
      });

    if (line) {
      lines.push(line);
    }

    const result = lines.join("\n");

    return (await onExport?.(result)) || result;
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
      height: 200,
      hideScrollbar: true,
      minPxPerSec: 250,
      ...optionsFromProps,
    }),
    [optionsFromProps],
  );

  useImperativeHandle(
    ref,
    () => ({
      handleExport,
    }),
    [handleExport],
  );

  return (
    <div tabIndex={0} onKeyDownCapture={handleKeyDown}>
      <WaveForm
        url={src}
        regions={regions}
        spectrogram={false}
        hover={false}
        options={options}
        onAudioLoaded={handleWaveFormInit}
        onRegionUpdated={handleRegionUpdate}
      />
    </div>
  );
}

export default forwardRef<ILyricsTimeLineRef, ILyricsTimeLineProps>(
  LyricsTimeLine,
);
