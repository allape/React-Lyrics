import cls from "classnames";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import Lyrics, { Millisecond, Progress, TimePoint } from "./core/lyrics.ts";
import styles from "./style.module.scss";

export const InteractedThreshold: Millisecond = 1500;
export const ScrollIntoThreshold: Millisecond = 200;

export type LineIndex = number;

export interface IAppProps {
  offset?: Millisecond;
  current?: Millisecond;
  karaoke?: boolean;
  content?: string;
  onChange?: (tp: TimePoint) => void;
}

export default function App({
  offset = 0,
  current = 0,
  karaoke,
  content,
  onChange,
}: IAppProps): ReactElement {
  const lastInteractTime = useRef<number>(0);
  const lastScrollIntoTime = useRef<number>(0);

  const [indexes, setIndexes] = useState<LineIndex[]>([]);
  const [progresses, setProgresses] = useState<Record<LineIndex, Progress[]>>(
    () => ({}),
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const [lyricsDriver, setLyricsDriver] = useState<Lyrics | null>(null);

  useEffect(() => {
    if (!content) {
      setLyricsDriver(null);
      return;
    }
    setLyricsDriver(Lyrics.parse(content));
  }, [content]);

  useEffect(() => {
    if (!lyricsDriver || !container) {
      return;
    }

    const now: Millisecond = current * 1000 + offset;

    const indexes = lyricsDriver.getLineIndexesByTimePoint(now);

    setIndexes(indexes);

    setProgresses(
      karaoke
        ? indexes.reduce<Record<LineIndex, Progress[]>>(
            (p, c) => ({
              ...p,
              [c]: lyricsDriver.getProgressesByTimePointInLine(now, c),
            }),
            {},
          )
        : [],
    );

    if (
      indexes.length > 0 &&
      performance.now() - lastInteractTime.current > InteractedThreshold &&
      performance.now() - lastScrollIntoTime.current > ScrollIntoThreshold
    ) {
      const line = container.querySelector(`[data-lyrics=index-${indexes[0]}]`);
      if (line) {
        line.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
        lastScrollIntoTime.current = performance.now();
      }
    }
  }, [container, current, karaoke, lyricsDriver, offset]);

  const handleInteracted = useCallback(() => {
    lastInteractTime.current = performance.now();
  }, []);

  return (
    <div
      ref={setContainer}
      className={styles.wrapper}
      onWheel={handleInteracted}
      onTouchStart={handleInteracted}
      onTouchEnd={handleInteracted}
      onTouchMove={handleInteracted}
    >
      <div className={styles.placeholder}></div>
      <div className={styles.lines}>
        {lyricsDriver?.lines.map((l, lineIndex) => (
          <div
            key={lineIndex}
            className={cls(
              styles.line,
              indexes.includes(lineIndex) && styles.current,
            )}
            data-lyrics={`index-${lineIndex}`}
            onClick={() => onChange?.((l[0] + offset) / 1000)}
          >
            {l[2].map((i, syllableIndex) => (
              <span
                key={`line${lineIndex}_s${syllableIndex}`}
                className={cls(styles.syllable, karaoke && styles.karaoke)}
              >
                <span className={styles.truth}>{i[2]}</span>
                <span
                  className={styles.mask}
                  style={{
                    width: karaoke
                      ? `${(progresses[lineIndex]?.[syllableIndex] || 0) * 100}%`
                      : "100%",
                  }}
                >
                  {i[2]}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.placeholder}></div>
    </div>
  );
}
