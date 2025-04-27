import { ReactElement } from "react";
import LyricsCreator from "../../component/LyricsCreator";
import useSrcTextFromSearchParams from "../../hook/useSrcTextFromSearchParams.ts";
import styles from "./style.module.scss";

export default function LyricsCreatorDemo(): ReactElement {
  const { src, text } = useSrcTextFromSearchParams();
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
          <code>[Space]</code> to toggle audio;
        </p>
        <p>
          <code>[Esc]</code> to focus lyrics recorder;
        </p>
        <p>
          <code>[Shift]+[Any Arrow Key]</code> to seek audio forwards/backwards.
        </p>
      </div>
      <LyricsCreator src={src} text={text} />
    </div>
  );
}
