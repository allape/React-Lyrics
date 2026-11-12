import { useProxy } from "@allape/use-loading";
import {
  KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react";
import { LyricsDriver } from "../../../index.ts";
import DroppableTextarea from "../../component/DroppableTextarea";
import FileInput from "../../component/FileInput";
import Lyrics from "../../component/Lyrics";
import { TimePoint } from "../../core/lyrics.ts";
import useRAFAudioTime from "../../hook/useRAFAudioTime.ts";
import useParamsFromSearchParams from "../../hook/useParamsFromSearchParams.ts";
import styles from "./style.module.scss";

export type Mode = "normal" | "karaoke";

export interface ISimplePlayerProps {
  url?: string;
  mode?: Mode;
  content?: string;
}

export default function SimplePlayer({
  url: urlFromProps,
  mode: modeFromProps,
  content,
}: ISimplePlayerProps): ReactElement {
  const [audio, audioRef, setAudio] = useProxy<HTMLAudioElement | null>(null);

  const [url, setUrl] = useState<string | undefined>(urlFromProps);
  const [text, setText] = useState<string | undefined>(content);

  const [mode, setMode] = useState<"normal" | "karaoke">(modeFromProps || "karaoke");

  const { src: srcFromSP, text: textFromSP } = useParamsFromSearchParams();

  useEffect(() => {
    if (srcFromSP) {
      setUrl(srcFromSP);
    }
  }, [srcFromSP]);

  useEffect(() => {
    if (textFromSP) {
      setText(textFromSP);
    }
  }, [setText, textFromSP]);

  useEffect(() => {
    if (modeFromProps) {
      setMode(modeFromProps);
    } else {
      setMode("karaoke");
    }
  }, [modeFromProps]);

  const [current] = useRAFAudioTime(audio);

  const handleChange = useCallback(
    (tp: TimePoint) => {
      if (audioRef.current) {
        audioRef.current.currentTime = tp / 1000;
      }
    },
    [audioRef],
  );

  const handleDriverChange = useCallback((driver: LyricsDriver) => {
    console.log(driver.toString());
  }, []);

  const handleKeyUp = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!audioRef.current) {
        return;
      }

      let touched = false;

      switch (e.key) {
        case " ": {
          if (audioRef.current.paused) {
            audioRef.current.play().then();
          } else {
            audioRef.current.pause();
          }
          touched = true;
          break;
        }
      }

      if (touched) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [audioRef],
  );

  return (
    <div className={styles.wrapper} tabIndex={0} onKeyDownCapture={handleKeyUp}>
      {!urlFromProps && (
        <>
          <FileInput value={url} onChange={setUrl} />
          <hr />
        </>
      )}
      {!content && (
        <>
          <DroppableTextarea
            className={styles.text}
            rows={10}
            placeholder="Add text or drop a LRC file here"
            value={text}
            onChange={setText}
          ></DroppableTextarea>
          <hr />
        </>
      )}
      {!modeFromProps && (
        <select value={mode} onChange={(e) => setMode(e.target.value as "normal" | "karaoke")}>
          <option value="normal">Normal</option>
          <option value="karaoke">Karaoke</option>
        </select>
      )}
      <audio ref={setAudio} className={styles.audio} src={url} controls></audio>
      <Lyrics
        current={current}
        content={text}
        karaoke={mode === "karaoke"}
        onChange={handleChange}
        onDriverChange={handleDriverChange}
      />
    </div>
  );
}
