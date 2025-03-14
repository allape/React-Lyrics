import { ReactElement, useCallback, useRef, useState } from "react";
import DroppableTextarea from "../../component/DroppableTextarea";
import FileInput from "../../component/FileInput";
import Lyrics from "../../component/Lyrics";
import { TimePoint } from "../../core/lyrics.ts";
import useRAFAudioTime from "../../hook/useRAFAudioTime.ts";
import styles from "./style.module.scss";

export interface ISimplePlayerProps {
  url?: string;
  content?: string;
}

export default function SimplePlayer({
  url: urlFromProps,
  content,
}: ISimplePlayerProps): ReactElement {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [url, setUrl] = useState<string | undefined>(urlFromProps);
  const [text, setText] = useState<string | undefined>(content);

  const [current] = useRAFAudioTime(audioRef);

  const handleChange = useCallback((tp: TimePoint) => {
    if (audioRef.current) {
      audioRef.current.currentTime = tp / 1000;
    }
  }, []);

  return (
    <div className={styles.wrapper}>
      <FileInput value={url} onChange={setUrl} />
      <hr />
      <DroppableTextarea
        className={styles.text}
        rows={10}
        placeholder="Add text or drop a LRC file here"
        value={text}
        onChange={setText}
      ></DroppableTextarea>
      <hr />
      <audio ref={audioRef} className={styles.audio} src={url} controls></audio>
      <Lyrics
        current={current}
        content={text}
        karaoke
        onChange={handleChange}
      />
    </div>
  );
}
