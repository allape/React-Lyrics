import { useProxy } from "@allape/use-loading";
import cls from "classnames";
import {
  ChangeEvent,
  DragEvent,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Lyrics, { Millisecond, TimePoint } from "../../core/lyrics.ts";
import styles from "./style.module.scss";

export type TimePoints = Record<number, Record<number, [TimePoint, TimePoint]>>;

export const DefaultWordSplitterRegexp = /([\w']+\s+|.)/gi;

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

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement> | DragEvent<HTMLAudioElement>) => {
      const files =
        "dataTransfer" in e ? e.dataTransfer?.files : e.currentTarget?.files;

      fileNameRef.current = files?.[0]?.name;

      const ab = await files?.[0]?.arrayBuffer();

      if (!ab) {
        return;
      }

      e.preventDefault();

      if ("value" in e.target) e.target.value = "";

      setAudioURL((old) => {
        if (old?.startsWith("blob:")) {
          URL.revokeObjectURL(old);
        }
        return URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
      });
    },
    [],
  );

  const lastDriverReloadedTime = useRef<number>(0);

  useEffect(() => {
    if (performance.now() - lastDriverReloadedTime.current < 1000) {
      return;
    }

    lastDriverReloadedTime.current = performance.now();

    timePointsRef.current = [];
    setLineIndex(0);
    setSyllableIndex(0);
    setLines([]);
    if (!text) {
      return;
    }

    let splitter = DefaultWordSplitterRegexp;

    try {
      splitter = new RegExp(wordSplitterRegexp, "gi");
    } catch (e) {
      alert(`${(e as Error)?.message || e}`);
      return;
    }

    setLines(text.split("\n").map((i) => i.match(splitter) || [i], []));
  }, [setLineIndex, setLines, setSyllableIndex, text, wordSplitterRegexp]);

  const handleSeek = useCallback((duration: Millisecond) => {
    if (!audioRef.current) {
      return;
    }
    const nextTime = audioRef.current.currentTime + duration / 1000;
    audioRef.current.currentTime = nextTime < 0 ? 0 : nextTime;
  }, []);

  useEffect(() => {
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
          touched = true;
          break;
        case "ArrowUp":
          handleSeek(-10_000);
          touched = true;
          break;

        case "ArrowRight":
        case "ArrowDown":
          if (!isKeyDown) {
            isKeyDown = true;
            keyDownTime = audioRef.current.currentTime * 1000;
            touched = true;
          }
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleSeek,
    lineIndexRef,
    linesRef,
    setLineIndex,
    setSyllableIndex,
    syllableIndexRef,
  ]);

  const handleExport = useCallback(() => {
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
      const blob = new Blob([lyrics], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileNameRef.current || "lyrics"}.lrc`;
      a.click();
      a.remove();
    }
  }, [linesRef, onExport]);

  return (
    <div className={styles.wrapper}>
      <input
        type="file"
        placeholder="Select the music"
        onChange={handleFileChange}
      />
      <input
        type="text"
        placeholder="Word split RegExp"
        value={wordSplitterRegexp}
        onChange={(e) => setWordSplitterRegexp(e.target.value)}
      />
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
        onDrop={handleFileChange}
        className={styles.audio}
        src={audioURL}
        controls
      ></audio>
      <div className={styles.lines}>
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
