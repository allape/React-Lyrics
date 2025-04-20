import { useLoading, useProxy } from "@allape/use-loading";
import cls from "classnames";
import {
  DragEvent,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { RegionParams } from "wavesurfer.js/plugins/regions";
import Lyrics, { Millisecond, TimePoint } from "../../core/lyrics.ts";
import FileInput from "../FileInput";
import WaveForm from "../Waveform";
import styles from "./style.module.scss";

const ForwardMore = 10_000;
const BackwardMore = -ForwardMore;
const Forward = 3_000;
const Backward = -Forward;

function KeyboardEventToMask(e: KeyboardEvent): KeyMask {
  return {
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    meta: e.metaKey,
  };
}

type KeyFunction =
  | "RevokeLine"
  | "NextSyllable"
  | "NextLine"
  | "ClearLine"
  | "PlayPause"
  | "Forward"
  | "ForwardMore"
  | "Backward"
  | "BackwardMore"
  | "Focus"
  | "RevokeSyllable";

type KeyMask = { ctrl?: boolean; shift?: boolean; meta?: boolean };

function KeyCodeToFunction(
  code: KeyboardEvent["code"],
  mask: KeyMask,
): KeyFunction | null {
  switch (code) {
    case "Space":
    case "Numpad0":
    case "Numpad5":
      return "PlayPause";

    case "KeyA":
    case "ArrowLeft":
    case "Numpad4":
      if (mask.shift) {
        return "Backward";
      }
      return "ClearLine";

    case "KeyW":
    case "ArrowUp":
    case "Numpad8":
      if (mask.shift) {
        return "BackwardMore";
      }
      return "RevokeLine";

    case "KeyD":
    case "ArrowRight":
    case "Enter":
    case "NumpadEnter":
    case "Numpad6":
      if (mask.shift) {
        return "Forward";
      }
      return "NextSyllable";

    case "KeyS":
    case "Numpad2":
    case "ArrowDown":
      if (mask.shift) {
        return "ForwardMore";
      }
      return "NextLine";

    case "NumpadAdd":
    case "Equal":
      return "ForwardMore";
    case "NumpadSubtract":
    case "Minus":
      return "BackwardMore";

    case "Escape":
      return "Focus";

    case "Backspace":
    case "Delete":
      return "RevokeSyllable";

    default:
      return null;
  }
}

export interface IWhisperSyllable {
  start: TimePoint;
  end: TimePoint;
  text: string;
}

export type TimePoints = Record<number, Record<number, [TimePoint, TimePoint]>>;

export const DefaultWordSplitterRegexp =
  /([-a-zA-ZÀ-ÿА-Яа-яЁё'¿?!¡,:;.~«»/]+|[“‘]?\S[。，”’？！、～~.:：]*)\s*/gi;

export interface ILyricsCreatorProps {
  audioSepURL?: string;
  whisperURL?: string;
  onExport?: (
    lyrics: string,
    lines: string[][],
    timePoints: TimePoints,
  ) => void;
}

export default function LyricsCreator({
  audioSepURL: audioSepURLFromProps,
  whisperURL: whisperURLFromProps,
  onExport,
}: ILyricsCreatorProps): ReactElement {
  const { loading, execute } = useLoading();

  const [text, textRef, setText] = useProxy<string>("");
  const [wordSplitterRegexp, wordSplitterRegexpRef, setWordSplitterRegexp] =
    useProxy<string>(DefaultWordSplitterRegexp.source);
  const [lines, linesRef, setLines] = useProxy<string[][]>([]);
  const [lineIndex, lineIndexRef, setLineIndex] = useProxy<number>(0);
  const [syllableIndex, syllableIndexRef, setSyllableIndex] =
    useProxy<number>(0);

  const [container, setContainer] = useState<HTMLElement | null>(null);

  const fileNameRef = useRef<string | undefined>(undefined);
  const [audioURL, setAudioURL] = useState<string | undefined>(undefined);

  const [, audioRef, setAudio] = useProxy<HTMLAudioElement | null>(null);

  const timePointsRef = useRef<TimePoints>({});

  const titleRef = useRef<HTMLHRElement | null>(null);

  const [spectrogram, spectrogramRef, setSpectrogram] =
    useProxy<boolean>(false);
  const [hover, setHover] = useState<boolean>(false);

  const [audioSepEnabled, audioSepEnabledRef, setAudioSepEnabled] =
    useProxy<boolean>(false);
  const [audioSepURL, audioSepURLRef, setAudioSepURL] = useProxy<string>(
    audioSepURLFromProps || "http://localhost:9090/?text=human+sing",
  );

  const [whisperEnabled, whisperEnabledRef, setWhisperEnabled] =
    useProxy<boolean>(false);
  const [whisperURL, whisperURLRef, setWhisperURL] = useProxy<string>(
    whisperURLFromProps || "http://localhost:9090/zh/inference",
  );

  const [regions, setRegions] = useState<RegionParams[]>([]);

  const handleBackToTop = useCallback(() => {
    titleRef.current?.scrollIntoView({
      block: "center",
    });
  }, []);

  const handleReload = useCallback(() => {
    timePointsRef.current = [];

    setLineIndex(0);
    setSyllableIndex(0);
    setLines([]);

    if (!textRef.current) {
      return;
    }

    let t = textRef.current;
    if (/\[\d+:\d+(?:\.\d+)?]/gi.test(t)) {
      const lrc = Lyrics.parseStandardLRC(t);
      t = lrc.toString();
    }

    let splitter = DefaultWordSplitterRegexp;

    try {
      splitter = new RegExp(wordSplitterRegexpRef.current, "gi");
    } catch (e) {
      alert(`${(e as Error)?.message || e}`);
      return;
    }

    setLines(
      t
        .split("\n")
        .filter((i) => !!i.trim())
        .map((i) => i.trim().match(splitter) || [i], []),
    );
  }, [
    setLineIndex,
    setLines,
    setSyllableIndex,
    textRef,
    wordSplitterRegexpRef,
  ]);

  const handleDropLRCFile = useCallback(
    async (e: DragEvent<HTMLTextAreaElement>) => {
      const file = e.dataTransfer.files[0];
      if (!file) {
        return;
      }

      e.preventDefault();

      const text = await file.text();
      if (/\[\d+:\d+(?:\.\d+)?]{2,}/gi.test(text)) {
        setText(Lyrics.parseStandardLRC(text).toString());
      } else {
        setText(Lyrics.parse(text).toString());
      }

      handleReload();
    },
    [handleReload, setText],
  );

  const handleSeek = useCallback(
    (duration: Millisecond) => {
      if (!audioRef.current) {
        return;
      }
      const nextTime = audioRef.current.currentTime + duration / 1000;
      audioRef.current.currentTime = nextTime < 0 ? 0 : nextTime;
    },
    [audioRef],
  );

  const handleExport = useCallback(() => {
    if (!linesRef.current.length) {
      alert("No lyrics to export");
      return;
    }

    const lyrics = linesRef.current
      .map((line, index) => {
        const timePoints = timePointsRef.current[index];
        if (!timePoints) {
          return line.join("");
        }

        const tps = Object.entries(timePoints);
        const syllables: string[] = [];
        for (let i = 0; i < line.length; i++) {
          let syllable = line[i];
          const st =
            tps[i]?.[1]?.[0] !== undefined
              ? Lyrics.toStringTimePoint(tps[i][1][0])
              : "";
          const et =
            tps[i]?.[1]?.[1] !== undefined
              ? Lyrics.toStringTimePoint(tps[i][1][1])
              : "";
          if (i === tps.length - 1) {
            syllable = line.slice(i).join("");
            i = line.length;
          }
          syllables.push(`${st}${syllable}${et}`);
        }

        return syllables.join("");
      })
      .join("\n");

    if (onExport) {
      onExport(lyrics, linesRef.current, timePointsRef.current);
    } else {
      let filename: string | null = `${fileNameRef.current || "lyrics"}.lrcp`;
      filename = window.prompt("Filename", filename);
      if (!filename) {
        console.log("No filename, export cancelled");
        return;
      }
      const blob = new Blob([lyrics], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNameRef.current || "lyrics"}.lrcp`;
      a.click();
      a.remove();
      handleBackToTop();
    }
  }, [handleBackToTop, linesRef, onExport]);

  const handleTogglePlay = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    if (audioRef.current.paused) {
      audioRef.current.play().then();
    } else {
      audioRef.current.pause();
    }
  }, [audioRef]);

  const scrollToCurrentLine = useCallback(() => {
    const ele = document.querySelector(
      `[data-line=index-${lineIndexRef.current}]`,
    );
    if (ele) {
      (ele.nextElementSibling || ele).scrollIntoView({
        behavior: "smooth",
        block: spectrogramRef.current ? "end" : "center",
      });
    }
  }, [lineIndexRef, spectrogramRef]);

  useEffect(() => {
    if (!container) {
      return;
    }

    let keyDownTime: Millisecond = 0;
    let isKeyDown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!audioRef.current) {
        return;
      }

      let touched = false;

      const func = KeyCodeToFunction(e.code, KeyboardEventToMask(e));

      switch (func) {
        case "Backward":
          handleSeek(Backward);
          touched = true;
          break;
        case "BackwardMore":
          handleSeek(BackwardMore);
          touched = true;
          break;
        case "Forward":
          handleSeek(Forward);
          touched = true;
          break;
        case "ForwardMore":
          handleSeek(ForwardMore);
          touched = true;
          break;

        case "PlayPause":
          handleTogglePlay();
          touched = true;
          break;

        case "ClearLine":
          timePointsRef.current[lineIndexRef.current] = {};
          setSyllableIndex(0);
          handleSeek(Backward);
          touched = true;
          break;

        case "RevokeSyllable":
          setSyllableIndex((v) => {
            const line = timePointsRef.current[lineIndexRef.current];
            if (line) {
              delete line[v];
            }
            return Math.max(v - 1, 0);
          });
          touched = true;
          break;

        case "RevokeLine":
          timePointsRef.current[lineIndexRef.current] = {};
          setSyllableIndex(0);
          setLineIndex((i) => {
            i = i - 1;
            if (i < 0) {
              i = 0;
            }
            timePointsRef.current[i] = {};
            return i;
          });
          touched = true;
          isKeyDown = true;
          break;

        case "NextSyllable":
        case "NextLine":
          if (!isKeyDown) {
            isKeyDown = true;
            keyDownTime = audioRef.current.currentTime * 1000;
          }
          touched = true;
          break;
      }

      if (touched) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isKeyDown || !audioRef.current) {
        return;
      }

      isKeyDown = false;

      timePointsRef.current[lineIndexRef.current] = {
        ...timePointsRef.current[lineIndexRef.current],
        [syllableIndexRef.current]: [
          keyDownTime,
          audioRef.current.currentTime * 1000,
        ],
      };

      const func = KeyCodeToFunction(e.code, KeyboardEventToMask(e));

      if (lineIndexRef.current >= linesRef.current.length) {
        if (func !== "RevokeLine") {
          setLineIndex(linesRef.current.length);
        }
      } else {
        if (func === "NextSyllable") {
          if (
            syllableIndexRef.current + 1 >=
            linesRef.current[lineIndexRef.current].length
          ) {
            setLineIndex(lineIndexRef.current + 1);
            setSyllableIndex(0);
          } else {
            setSyllableIndex(syllableIndexRef.current + 1);
          }
        } else if (func === "NextLine") {
          setLineIndex(lineIndexRef.current + 1);
          setSyllableIndex(0);
        }
      }

      scrollToCurrentLine();
    };

    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("keyup", handleKeyUp);

    let scrollerTimer = -1;

    const handleWindowKeyup = (e: KeyboardEvent) => {
      if (KeyCodeToFunction(e.code, KeyboardEventToMask(e)) === "Focus") {
        container.focus();
        clearTimeout(scrollerTimer);
        scrollerTimer = setTimeout(
          () => scrollToCurrentLine(),
          100,
        ) as unknown as number;
      }
    };

    window.addEventListener("keyup", handleWindowKeyup);
    return () => {
      clearTimeout(scrollerTimer);

      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("keyup", handleKeyUp);

      window.removeEventListener("keyup", handleWindowKeyup);
    };
  }, [
    handleSeek,
    lineIndexRef,
    linesRef,
    setLineIndex,
    setSyllableIndex,
    syllableIndexRef,
    container,
    handleTogglePlay,
    audioRef,
    spectrogramRef,
    scrollToCurrentLine,
  ]);

  const handleAudioLoaded = useCallback(
    (s: WaveSurfer) => {
      setAudio(s.getMediaElement());
    },
    [setAudio],
  );

  const handleFile = useCallback(
    async (fileOrURL: ArrayBuffer | string): Promise<string> => {
      try {
        return await execute(async (): Promise<string> => {
          if (typeof fileOrURL === "string") {
            fileOrURL = await (await fetch(fileOrURL)).arrayBuffer();
          }

          if (whisperEnabledRef.current && whisperURLRef.current) {
            try {
              const whisperSyllables: IWhisperSyllable[] = await (
                await fetch(whisperURLRef.current, {
                  method: "PUT",
                  body: fileOrURL,
                })
              ).json();

              setRegions(
                whisperSyllables.map((syll) => ({
                  start: syll.start / 1000,
                  end: syll.end / 1000,
                  content: syll.text,
                  drag: false,
                  resize: false,
                })),
              );
            } catch (e) {
              alert(`Error: ${e}`);
            }
          }

          if (audioSepEnabledRef.current && audioSepURLRef.current) {
            const file = await (
              await fetch(audioSepURLRef.current, {
                method: "PUT",
                body: fileOrURL,
              })
            ).blob();

            return URL.createObjectURL(file);
          }

          return "";
        });
      } catch (e) {
        alert(`Error: ${e}`);
        return "";
      }
    },
    [
      execute,
      whisperEnabledRef,
      whisperURLRef,
      audioSepEnabledRef,
      audioSepURLRef,
    ],
  );

  return (
    <div className={styles.wrapper}>
      <FileInput value={audioURL} onChange={setAudioURL} onFile={handleFile} />
      <hr ref={titleRef} />
      <div className={styles.advanced}>
        <div className={styles.controls}>
          <label onClick={() => setAudioSepEnabled((i) => !i)}>
            {loading && audioSepEnabled
              ? "Enhancing..."
              : "Human Voice Enhance:"}
          </label>
          <input
            type="checkbox"
            checked={audioSepEnabled}
            onChange={() => setAudioSepEnabled((i) => !i)}
          />
          <a
            href="https://github.com/allape/sdui-pub/tree/pub/audiosep"
            target="_blank"
          >
            How to Setup?
          </a>
        </div>
        <input
          disabled={!audioSepEnabled}
          placeholder="Human Voice Enhance URL"
          type="text"
          value={audioSepURL}
          onChange={(e) => setAudioSepURL(e.target.value)}
        />
        <hr />
      </div>
      <div className={styles.advanced}>
        <div className={styles.controls}>
          <label onClick={() => setWhisperEnabled((i) => !i)}>
            {loading && whisperEnabled ? "Whispering..." : "Speech to Text:"}
          </label>
          <input
            type="checkbox"
            checked={whisperEnabled}
            onChange={() => setWhisperEnabled((i) => !i)}
          />
          <a
            href="https://github.com/allape/sdui-pub/tree/pub/whisper"
            target="_blank"
          >
            How to Setup?
          </a>
        </div>
        <input
          disabled={!whisperEnabled}
          placeholder="Whisper URL"
          type="text"
          value={whisperURL}
          onChange={(e) => setWhisperURL(e.target.value)}
        />
        <hr />
      </div>
      <label>Word Split RegExp:</label>
      <input
        type="text"
        placeholder="Word split RegExp"
        value={wordSplitterRegexp}
        onChange={(e) => setWordSplitterRegexp(e.target.value)}
        onBlur={handleReload}
      />
      <hr />
      <textarea
        className={styles.text}
        onDrop={handleDropLRCFile}
        rows={10}
        placeholder="Add lyrics here or drop a LRC/LRCP file here"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleReload}
      ></textarea>
      <hr />
      <div className={styles.audio}>
        <div className={styles.controls}>
          <label onClick={() => setSpectrogram((i) => !i)}>Spectrogram:</label>
          <input
            type="checkbox"
            checked={spectrogram}
            onChange={() => setSpectrogram((i) => !i)}
          />
          <div className={styles.sep}>|</div>
          <label onClick={() => setHover((i) => !i)}>Hover:</label>
          <input
            type="checkbox"
            checked={hover}
            onChange={() => setHover((i) => !i)}
          />
        </div>
        <WaveForm
          url={audioURL}
          spectrogram={spectrogram}
          hover={hover}
          regions={whisperEnabled ? regions : undefined}
          onAudioLoaded={handleAudioLoaded}
        />
      </div>
      <hr />
      <div
        className={styles.lines}
        tabIndex={0}
        ref={setContainer}
        onClick={(e) => e.currentTarget.focus()}
      >
        <p className={styles.empty}>
          {lines.length === 0 ? "No Syllable Found" : undefined}
        </p>
        {lines.map((line, li) => {
          return (
            <div key={li} className={styles.line} data-line={`index-${li}`}>
              {line.map((syllable, si) => {
                const isCurrentLine = lineIndex === li;
                return (
                  <span
                    key={`line${li}_syllable${si}`}
                    onClick={() => {
                      setLineIndex(li);
                      setSyllableIndex(si);
                    }}
                    className={cls(
                      styles.syllable,
                      (isCurrentLine && syllableIndex > si) || lineIndex > li
                        ? styles.filled
                        : undefined,
                      isCurrentLine && syllableIndex === si && styles.current,
                    )}
                  >
                    {syllable.trim()}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className={styles.buttons}>
        <button onClick={handleExport}>Export</button>
      </div>
    </div>
  );
}
