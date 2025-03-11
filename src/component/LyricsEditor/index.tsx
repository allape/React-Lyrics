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

export const DefaultWordSplitterRegexp = /([\w']+|.)/gi;

export interface ILyricsEditorProps {}

export default function LyricsEditor({}: ILyricsEditorProps): ReactElement {
  const [text, setText] = useState<string>("");
  const [wordSplitterRegexp, setWordSplitterRegexp] = useState<string>(
    () => DefaultWordSplitterRegexp.source,
  );
  const [lines, linesRef, setLines] = useProxy<string[][]>([]);
  const [lineIndex, lineIndexRef, setLineIndex] = useProxy<number>(0);
  const [syllableIndex, syllableIndexRef, setSyllableIndex] =
    useProxy<number>(0);
  const [audioURL, setAudioURL] = useState<string | undefined>(undefined);
  const [current, currentRef, setCurrent] = useProxy<TimePoint>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const timePointsRef = useRef<
    Record<number, Record<number, [TimePoint, TimePoint]>>
  >({});

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
    async (e: ChangeEvent<HTMLInputElement>) => {
      const blob = await e.currentTarget.files?.[0]?.arrayBuffer();
      e.target.value = "";
      if (!blob) {
        return;
      }
      setAudioURL((old) => {
        if (old?.startsWith("blob:")) {
          URL.revokeObjectURL(old);
        }
        return URL.createObjectURL(new Blob([blob], { type: "audio/mpeg" }));
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

    setLines(
      text.split("\n").map(
        (i) =>
          i
            .trim()
            .split(" ")
            .map((i) => i.match(splitter) || [i])
            .reduce((p, c) => [...p, ...c]),
        [],
      ),
    );
  }, [setLineIndex, setLines, setSyllableIndex, text, wordSplitterRegexp]);

  useEffect(() => {
    let keyDownTime: Millisecond = 0;
    let isKeyDown = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isKeyDown || !audioRef.current || audioRef.current.paused) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        isKeyDown = true;
        keyDownTime = currentRef.current * 1000;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isKeyDown) {
        return;
      }

      isKeyDown = false;

      timePointsRef.current[lineIndexRef.current] = {
        ...timePointsRef.current[lineIndexRef.current],
        [syllableIndexRef.current]: [keyDownTime, currentRef.current * 1000],
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
    currentRef,
    lineIndexRef,
    linesRef,
    setLineIndex,
    setSyllableIndex,
    syllableIndexRef,
  ]);

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
        className={styles.audio}
        src={audioURL}
        controls
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime * 1000)}
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
                    {syllable}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
