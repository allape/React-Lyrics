import {
  ChangeEvent,
  ReactElement,
  useCallback, useEffect,
  useRef,
  useState,
} from 'react';
import { TimePoint } from "../../core/lyrics.ts";
import DroppableTextarea from "../../component/DroppableTextarea";
import Lyrics from "../../component/Lyrics";
import styles from "./style.module.scss";

export interface ISimplePlayerProps {
  url?: string;
  content?: string;
}

export default function SimplePlayer({
  url: urlFromProps,
  content,
}: ISimplePlayerProps): ReactElement {
  const [url, setUrl] = useState<string | undefined>(urlFromProps);
  const [text, setText] = useState<string | undefined>(content);
  const [current, setCurrent] = useState<TimePoint>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const ab = await e.currentTarget?.files?.[0]?.arrayBuffer();
    if (e.target) {
      e.target.value = "";
    }
    if (!ab) {
      return;
    }

    setUrl((old) => {
      if (old?.startsWith("blob:")) {
        URL.revokeObjectURL(old);
      }
      return URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
    });
  }, []);

  const handleChangeTime = useCallback((tp: TimePoint) => {
    if (audioRef.current) {
      audioRef.current.currentTime = tp / 1000;
    }
  }, []);

  useEffect(() => {

  }, []);

  return (
    <div className={styles.wrapper}>
      <input type="file" onChange={handleChange} />
      <hr />
      <DroppableTextarea
        className={styles.text}
        rows={10}
        placeholder="Add text or drop a LRC file here"
        value={text}
        onChange={setText}
      ></DroppableTextarea>
      <hr />
      <audio
        ref={audioRef}
        className={styles.audio}
        src={url}
        controls
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime * 1000)}
      ></audio>
      <Lyrics
        current={current}
        content={text}
        karaoke
        onChange={handleChangeTime}
      />
    </div>
  );
}
