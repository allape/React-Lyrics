import cls from "classnames";
import {
  CSSProperties,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import LyricsDriver, {
  Millisecond,
  Progress,
  TimePoint,
} from "../../core/lyrics.ts";
import styles from "./style.module.scss";

export const InteractedThreshold: Millisecond = 1500;
export const ScrollIntoThreshold: Millisecond = 200;
export const NormalHumanDelay: Millisecond = 100;

export type LineIndex = number;

export interface IClassNames {
  wrapper?: string;
  placeholder?: string;
  lines?: string;
  line?: string;
  current?: string;
  syllable?: string;
  karaoke?: string;
  truth?: string;
  hasSpace?: string;
  mask?: string;
}

export interface ILyricsProps {
  offset?: Millisecond;
  current?: Millisecond;
  karaoke?: boolean;
  content?: string;
  classNames?: IClassNames;
  styles?: Partial<Record<"line" | "syllable" | "mask", CSSProperties>>;
  onChange?: (tp: TimePoint) => void;
}

export default function Lyrics({
  offset = 0,
  current = 0,
  karaoke,
  content,
  styles: stylesFromProps,
  classNames,
  onChange,
}: ILyricsProps): ReactElement {
  const lastInteractTime = useRef<number>(0);
  const lastScrollIntoTime = useRef<number>(0);

  const [indexes, setIndexes] = useState<LineIndex[]>([]);
  const [progresses, setProgresses] = useState<Record<LineIndex, Progress[]>>(
    () => ({}),
  );
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const [lyricsDriver, setLyricsDriver] = useState<LyricsDriver | null>(null);

  useEffect(() => {
    if (!content) {
      setLyricsDriver(null);
      return;
    }
    const driver = LyricsDriver.parse(content);
    driver.glueLine();
    driver.insertStartIndicator();
    setLyricsDriver(driver);
  }, [content]);

  useEffect(() => {
    if (!lyricsDriver || !container) {
      return;
    }

    const now: Millisecond =
      current + offset + (karaoke ? NormalHumanDelay : 0);

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
      className={cls(styles.wrapper, classNames?.wrapper)}
      onWheel={handleInteracted}
      onTouchStart={handleInteracted}
      onTouchEnd={handleInteracted}
      onTouchMove={handleInteracted}
    >
      <div className={cls(styles.placeholder, classNames?.placeholder)}></div>
      <div className={cls(styles.lines, classNames?.lines)}>
        {lyricsDriver?.lines.map((l, lineIndex) => (
          <div
            key={lineIndex}
            className={cls(
              styles.line,
              classNames?.line,
              indexes.includes(lineIndex) && [
                styles.current,
                classNames?.current,
              ],
            )}
            data-lyrics={`index-${lineIndex}`}
            onClick={() => onChange?.(l[0] + offset - NormalHumanDelay)}
            style={stylesFromProps?.line}
          >
            {l[2].map((i, syllableIndex) => {
              const hasSpace = i[2].endsWith(" ") || i[2].startsWith(" ");
              return (
                <div
                  key={`line${lineIndex}_s${syllableIndex}`}
                  className={cls(
                    styles.syllable,
                    classNames?.syllable,
                    karaoke && [styles.karaoke, classNames?.karaoke],
                  )}
                >
                  <div
                    className={cls(
                      styles.truth,
                      classNames?.truth,
                      hasSpace && [styles.hasSpace, classNames?.hasSpace],
                    )}
                    style={stylesFromProps?.syllable}
                  >
                    {i[2]}
                  </div>
                  {karaoke && (
                    <div
                      className={cls(
                        styles.mask,
                        classNames?.mask,
                        hasSpace && [styles.hasSpace, classNames?.hasSpace],
                      )}
                      style={{
                        ...stylesFromProps?.mask,
                        width: karaoke
                          ? `${(progresses[lineIndex]?.[syllableIndex] || 0) * 100}%`
                          : "100%",
                      }}
                    >
                      {i[2]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={cls(styles.placeholder, classNames?.placeholder)}></div>
    </div>
  );
}
