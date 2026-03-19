import { ReactElement, useCallback, useState } from "react";
import LyricsCreator, {
  WordSplitterRegexps,
} from "../../component/LyricsCreator";
import { LyricsText, SRC } from "../../example/LInternationale.ts";
import {
  LyricsText as NGGYULRC,
  SRC as NGGYUSRC,
} from "../../example/NeverGonnaGiveYouUp.ts";
import useParamsFromSearchParams from "../../hook/useParamsFromSearchParams.ts";
import styles from "./style.module.scss";

export default function LyricsCreatorDemo(): ReactElement {
  const {
    src: srcFromProps,
    text: textFromProps,
    remoteTouchpadURL,
    remoteTouchpadClientID,
  } = useParamsFromSearchParams();

  const [src, setSrc] = useState<string | undefined>(undefined);
  const [text, setText] = useState<string | undefined>(undefined);
  const [regexp, setRegexp] = useState<string | undefined>(undefined);

  const [useDoubleSpaceSeparate, setUseDoubleSpaceSeparate] =
    useState<boolean>(false);

  const handleClick = useCallback(() => {
    setSrc(SRC);
    setText(LyricsText);
    setUseDoubleSpaceSeparate(false);
    setRegexp(WordSplitterRegexps.Default.source);
  }, []);

  const handleNGGYU = useCallback(() => {
    setSrc(NGGYUSRC);
    setText(NGGYULRC);
    setUseDoubleSpaceSeparate(true);
    setRegexp(WordSplitterRegexps["Split By Space"].source);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.lyricsCreator}>
        <p>
          <code>[→] / [d] / [Enter]</code> to go to next syllable, hold it press
          down for a long breath syllable;
        </p>
        <p>
          <code>[↓] / [s]</code> to go to next line;
        </p>
        <p>
          <code>[←] / [a]</code> to clear current line and seek audio backwards
          for a while;
        </p>
        <p>
          <code>[↑] / [w]</code> to go back one line;
        </p>
        <p>
          <code>[Space]</code> to play or pause;
        </p>
        <p>
          <code>[Esc]</code> to focus lyrics recorder;
        </p>
        <p>
          <code>[Shift]+[Any Arrow Key]</code> to seek audio forwards/backwards.
        </p>
        <p>
          <code>[Shift]+[1] or [1]</code> to set playback rate to 1.
        </p>
        <p>
          <code>[2]</code> to set playback rate to 2.
          <code>[Shift]+[2]</code> to set playback rate to 0.5.
        </p>
        <p>
          <button onClick={handleClick}>Try with demo song and lyrics</button>{" "}
          <button onClick={handleNGGYU}>Never Ganna Give You Up</button>
        </p>
      </div>
      <hr />
      <LyricsCreator
        src={src || srcFromProps}
        text={text || textFromProps}
        regexp={regexp}
        useDoubleSpaceSeparate={useDoubleSpaceSeparate}
        remoteTouchpadURL={remoteTouchpadURL}
        remoteTouchpadClientID={remoteTouchpadClientID}
      />
    </div>
  );
}
