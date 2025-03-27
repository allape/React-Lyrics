import { useProxy } from "@allape/use-loading";
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
import Lyrics, { Millisecond, TimePoint } from "../../core/lyrics.ts";
import FileInput from "../FileInput";
import WaveForm from "../Waveform";
import styles from "./style.module.scss";

export type TimePoints = Record<number, Record<number, [TimePoint, TimePoint]>>;

export const DefaultWordSplitterRegexp = /([a-zA-Z'?,;.]+|\S[。，]?)\s*/gi;

export interface ILyricsEditorProps {
  onExport?: (
    lyrics: string,
    lines: string[][],
    timePoints: TimePoints,
  ) => void;
}

export default function LyricsEditor({
  onExport,
}: ILyricsEditorProps): ReactElement {
  const [text, textRef, setText] = useProxy<string>("");
  const [wordSplitterRegexp, wordSplitterRegexpRef, setWordSplitterRegexp] =
    useProxy<string>(DefaultWordSplitterRegexp.source);
  const [lines, linesRef, setLines] = useProxy<string[][]>([]);
  const [lineIndex, lineIndexRef, setLineIndex] = useProxy<number>(0);
  const [syllableIndex, syllableIndexRef, setSyllableIndex] =
    useProxy<number>(0);

  const [editor, setEditor] = useState<HTMLElement | null>(null);

  const fileNameRef = useRef<string | undefined>(undefined);
  const [audioURL, setAudioURL] = useState<string | undefined>(undefined);

  const [, audioRef, setAudio] = useProxy<HTMLAudioElement | null>(null);

  const timePointsRef = useRef<TimePoints>({});

  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const handleBackToTop = useCallback(() => {
    titleRef.current?.scrollIntoView({
      block: "start",
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
          const st = Lyrics.toStringTimePoint(tps[i][1][0]);
          const et = Lyrics.toStringTimePoint(tps[i][1][1]);
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

  useEffect(() => {
    if (!editor) {
      return;
    }

    let keyDownTime: Millisecond = 0;
    let isKeyDown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!audioRef.current) {
        return;
      }

      let touched = false;

      if (e.shiftKey) {
        switch (e.key) {
          case " ":
            handleTogglePlay();
            touched = true;
            break;
          case "ArrowLeft":
            handleSeek(-3_000);
            touched = true;
            break;
          case "ArrowUp":
            handleSeek(-10_000);
            touched = true;
            break;

          case "ArrowRight":
            handleSeek(3_000);
            touched = true;
            break;
          case "ArrowDown":
            if (!isKeyDown) {
              handleSeek(10_000);
              touched = true;
              break;
            }
        }
      } else {
        switch (e.key) {
          case " ":
            handleTogglePlay();
            touched = true;
            break;
          case "ArrowLeft":
            timePointsRef.current[lineIndexRef.current] = {};
            handleSeek(-3_000);
            setSyllableIndex(0);
            touched = true;
            break;
          case "ArrowUp":
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
            break;

          case "ArrowRight":
          case "ArrowDown":
            if (!isKeyDown) {
              isKeyDown = true;
              keyDownTime = audioRef.current.currentTime * 1000;
            }
            touched = true;
            break;
        }
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

      if (lineIndexRef.current >= linesRef.current.length) {
        setLineIndex(lineIndexRef.current + 1);
        return;
      }

      if (e.key === "ArrowRight") {
        if (
          syllableIndexRef.current + 1 >=
          linesRef.current[lineIndexRef.current].length
        ) {
          setLineIndex(lineIndexRef.current + 1);
          setSyllableIndex(0);
        } else {
          setSyllableIndex(syllableIndexRef.current + 1);
        }
      } else if (e.key === "ArrowDown") {
        setLineIndex(lineIndexRef.current + 1);
        setSyllableIndex(0);
      }

      document
        .querySelector(`[data-line=index-${lineIndexRef.current}]`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    };

    editor.addEventListener("keydown", handleKeyDown);
    editor.addEventListener("keyup", handleKeyUp);
    return () => {
      editor.removeEventListener("keydown", handleKeyDown);
      editor.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleSeek,
    lineIndexRef,
    linesRef,
    setLineIndex,
    setSyllableIndex,
    syllableIndexRef,
    editor,
    handleTogglePlay,
    audioRef,
  ]);

  const handleAudioLoaded = useCallback(
    (s: WaveSurfer) => {
      setAudio(s.getMediaElement());
    },
    [setAudio],
  );

  return (
    <div className={styles.wrapper}>
      <h2 ref={titleRef}>Lyrics Editor</h2>
      <FileInput value={audioURL} onChange={setAudioURL} />
      <hr />
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
        placeholder="Add text or drop a LRC file here"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleReload}
      ></textarea>
      <hr />
      <div className={styles.audio}>
        <WaveForm url={audioURL} onAudioLoaded={handleAudioLoaded} />
      </div>
      <hr />
      <p>[Space] to toggle player, [Shift] + [Arrow Keys] to seek player;</p>
      <p>Hold [Arrow Keys] to start recording syllable.</p>
      <hr />
      <div
        className={styles.lines}
        tabIndex={0}
        ref={setEditor}
        onClick={(e) => e.currentTarget.focus()}
      >
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
