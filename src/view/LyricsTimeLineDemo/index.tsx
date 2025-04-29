import { useProxy } from "@allape/use-loading";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import DroppableTextarea from "../../component/DroppableTextarea";
import FileInput from "../../component/FileInput";
import LyricsTimeLine, {
  ILyricsTimeLineRef,
} from "../../component/LyricsTimeLine";
import { LyricsText, OGG } from "../../example/LInternationale.ts";
import useSrcTextFromSearchParams from "../../hook/useSrcTextFromSearchParams.ts";
import styles from "./style.module.scss";

function log(...msg: unknown[]): void {
  console.log(...msg);
}

export default function LyricsTimeLineDemo(): ReactElement {
  const ltlRef = useRef<ILyricsTimeLineRef | null>(null);

  const [src, setSrc] = useState<string>(OGG);
  const [text, textRef, setText] = useProxy<string | undefined>(LyricsText);

  const [renderingText, setRenderingText] = useState<string>(LyricsText);
  const [editable, setEditable] = useState<boolean>(false);

  const { src: srcFromSP, text: textFromSP } = useSrcTextFromSearchParams();

  useEffect(() => {
    if (srcFromSP) {
      setSrc(srcFromSP);
    }
  }, [srcFromSP]);

  useEffect(() => {
    if (textFromSP) {
      setEditable(true);
      setText(textFromSP);
      setRenderingText(textFromSP);
    }
  }, [setText, textFromSP]);

  const handleExport = useCallback(async () => {
    const lyrics = await ltlRef.current?.handleExport();
    if (!lyrics) {
      return;
    }

    const blob = new Blob([lyrics], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lyrics.lrcp`;
    a.click();
    a.remove();
  }, []);

  const handleTextBlur = useCallback(() => {
    setRenderingText(textRef.current || "");
  }, [textRef]);

  const handleApply = useCallback(async () => {
    const lyrics = await ltlRef.current?.handleExport();
    if (!lyrics) {
      return;
    }

    setText(lyrics);
  }, [setText]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.fileContainer}>
        <FileInput value={src} onChange={setSrc} />
      </div>
      <div className={styles.textContainer}>
        <DroppableTextarea
          className={styles.text}
          rows={10}
          placeholder="Add lyrics here or drop a LRCP file here"
          value={text}
          onChange={setText}
          onBlur={handleTextBlur}
        ></DroppableTextarea>
      </div>
      <hr />
      <p className={styles.row}>
        <label htmlFor="LyricsTimeLineDemo_Editable">Editable:</label>
        <input
          id="LyricsTimeLineDemo_Editable"
          type="checkbox"
          checked={editable}
          onChange={() => setEditable((o) => !o)}
        />
      </p>
      <LyricsTimeLine
        ref={ltlRef}
        src={src}
        lyrics={renderingText}
        editable={editable}
        styleOfSyllable="font-size: 24px; white-space: wrap;"
        onExport={log}
      />
      {editable && (
        <div className={styles.buttons}>
          <button className={styles.button} onClick={handleApply}>
            Put Into Text Field
          </button>
          <button className={styles.button} onClick={handleExport}>
            Export Refined Lyrics
          </button>
        </div>
      )}
    </div>
  );
}
