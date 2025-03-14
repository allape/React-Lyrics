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
import Lyrics, { Millisecond, TimePoint } from "../../core/lyrics.ts";
import FileInput from "../FileInput";
import styles from "./style.module.scss";

export type TimePoints = Record<number, Record<number, [TimePoint, TimePoint]>>;

export const DefaultWordSplitterRegexp = /([\w'?.]+|\S[。，]?)\s*/gi;

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
  const [text, setText] = useState<string>("");
  const [wordSplitterRegexp, setWordSplitterRegexp] = useState<string>(
    () => DefaultWordSplitterRegexp.source,
  );
  const [lines, linesRef, setLines] = useProxy<string[][]>([]);
  const [lineIndex, lineIndexRef, setLineIndex] = useProxy<number>(0);
  const [syllableIndex, syllableIndexRef, setSyllableIndex] =
    useProxy<number>(0);

  const [editor, setEditor] = useState<HTMLElement | null>(null);

  const fileNameRef = useRef<string | undefined>(undefined);
  const [audioURL, setAudioURL] = useState<string | undefined>(undefined);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const timePointsRef = useRef<TimePoints>({});

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
    },
    [],
  );

  useEffect(() => {
    timePointsRef.current = [];

    setLineIndex(0);
    setSyllableIndex(0);
    setLines([]);

    if (!text) {
      return;
    }

    let t = text;
    if (/\[\d+:\d+(?:\.\d+)?]/gi.test(t)) {
      const lrc = Lyrics.parseStandardLRC(t);
      t = lrc.toString();
    }

    let splitter = DefaultWordSplitterRegexp;

    try {
      splitter = new RegExp(wordSplitterRegexp, "gi");
    } catch (e) {
      alert(`${(e as Error)?.message || e}`);
      return;
    }

    setLines(t.split("\n").map((i) => i.trim().match(splitter) || [i], []));
  }, [setLineIndex, setLines, setSyllableIndex, text, wordSplitterRegexp]);

  const handleSeek = useCallback((duration: Millisecond) => {
    if (!audioRef.current) {
      return;
    }
    const nextTime = audioRef.current.currentTime + duration / 1000;
    audioRef.current.currentTime = nextTime < 0 ? 0 : nextTime;
  }, []);

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
      let filename = `${fileNameRef.current || "lyrics"}.lrcp`;
      filename = window.prompt("Filename", filename) || filename;
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
    }
  }, [linesRef, onExport]);

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

      switch (e.key) {
        case " ":
          if (audioRef.current.paused) {
            audioRef.current.play().then();
          } else {
            audioRef.current.pause();
          }
          touched = true;
          break;

        case "ArrowLeft":
          handleSeek(-3_000);
          setSyllableIndex(0);
          touched = true;
          break;
        case "ArrowUp":
          handleSeek(-10_000);
          setSyllableIndex(0);
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
  ]);

  return (
    <div className={styles.wrapper}>
      <FileInput value={audioURL} onChange={setAudioURL} />
      <hr />
      <input
        type="text"
        placeholder="Word split RegExp"
        value={wordSplitterRegexp}
        onChange={(e) => setWordSplitterRegexp(e.target.value)}
      />
      <hr />
      <textarea
        className={styles.text}
        onDrop={handleDropLRCFile}
        rows={10}
        placeholder="Add text or drop a LRC file here"
        value={text}
        onChange={(e) => setText(e.target.value)}
      ></textarea>
      <hr />
      <audio
        ref={audioRef}
        className={styles.audio}
        src={audioURL}
        controls
      ></audio>
      <hr />
      <p>Try with Arrow Keys, you will figure it out :)</p>
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
                return (
                  <span
                    key={`line${li}_syllable${si}`}
                    onClick={() => {
                      setLineIndex(li);
                      setSyllableIndex(si);
                    }}
                    className={cls(
                      styles.syllable,
                      (lineIndex === li && syllableIndex > si) || lineIndex > li
                        ? styles.filled
                        : undefined,
                      lineIndex === li &&
                        syllableIndex === si &&
                        styles.current,
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
