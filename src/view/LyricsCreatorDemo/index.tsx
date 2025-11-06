import { ReactElement, useCallback, useState } from "react";
import LyricsCreator from "../../component/LyricsCreator";
import { LyricsText, OGG } from "../../example/LInternationale.ts";
import useSrcTextFromSearchParams from "../../hook/useSrcTextFromSearchParams.ts";
import styles from "./style.module.scss";

export default function LyricsCreatorDemo(): ReactElement {
  const { src: srcFromProps, text: textFromProps } =
    useSrcTextFromSearchParams();

  const [src, setSrc] = useState<string | undefined>(undefined);
  const [text, setText] = useState<string | undefined>(undefined);

  const handleClick = useCallback(() => {
    setSrc(OGG);
    setText(LyricsText);
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
          <button onClick={handleClick}>Try with demo song and lyrics</button>
        </p>
      </div>
      <hr />
      <LyricsCreator src={src || srcFromProps} text={text || textFromProps} />
    </div>
  );
}
