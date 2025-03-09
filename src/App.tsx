import cls from "classnames";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import Lyrics, { Millisecond, TimePoint } from "./core/lyrics.ts";
import styles from "./style.module.scss";

export interface IAppProps {
  offset?: Millisecond;
  current?: Millisecond;
  content?: string;
  onChange?: (tp: TimePoint) => void;
}

export default function App({
  offset = 0,
  current = 0,
  content,
  onChange,
}: IAppProps): ReactElement {
  const lastInteractTime = useRef<number>(0);
  const lastScrollIntoTime = useRef<number>(0);

  const [index, setIndex] = useState<number>(-1);
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

    const index = lyricsDriver.getLineIndexByTimePoint(current * 1000 + offset);
    if (index === -1) {
      return;
    }

    setIndex(index);

    if (
      performance.now() - lastInteractTime.current > 1000 &&
      performance.now() - lastScrollIntoTime.current > 200
    ) {
      const line = container.querySelector(`[data-lyrics=index-${index}]`);
      if (line) {
        line.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
        lastScrollIntoTime.current = performance.now();
      }
    }
  }, [container, current, lyricsDriver, offset]);

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
    >
      <div className={styles.placeholder}></div>
      <div className={styles.lines}>
        {lyricsDriver?.lines.map((l, i) => (
          <div
            key={i}
            className={cls(styles.line, index === i && styles.current)}
            data-lyrics={`index-${i}`}
            onClick={() => onChange?.((l[0] + offset) / 1000)}
          >
            {l[2].map((i) => i[2]).join("")}
          </div>
        ))}
      </div>
      <div className={styles.placeholder}></div>
    </div>
  );
}
