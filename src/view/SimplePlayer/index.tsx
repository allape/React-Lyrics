import {
  ChangeEvent,
  DragEvent,
  ReactElement,
  useCallback,
  useRef,
  useState,
} from "react";
import DroppableTextarea from "../../component/DroppableTextarea";
import Lyrics from "../../component/Lyrics";
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

  const handleChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement> | DragEvent<HTMLElement>) => {
      const files =
        "dataTransfer" in e ? e.dataTransfer?.files : e.currentTarget?.files;
      const ab = await files?.[0]?.arrayBuffer();

      if (!ab) {
        return;
      }

      e.preventDefault();

      setUrl((old) => {
        if (old?.startsWith("blob:")) {
          URL.revokeObjectURL(old);
        }
        return URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" }));
      });
    },
    [],
  );

  return (
    <div className={styles.wrapper} onDrop={handleChange}>
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
      <audio ref={audioRef} className={styles.audio} src={url} controls></audio>
      <Lyrics current={current} content={text} karaoke />
    </div>
  );
}
