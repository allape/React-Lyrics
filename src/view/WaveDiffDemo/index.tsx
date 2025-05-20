import { ReactElement, useCallback, useRef, useState } from "react";
import FileInput from "../../component/FileInput";
import WaveDiff, { Multitrack } from "../../component/WaveDiff";
import styles from "./style.module.scss";

export default function WaveDiffDemo(): ReactElement {
  const multitrackRef = useRef<Multitrack | null>(null);

  const [file1, setFile1] = useState<string>("");
  const [file2, setFile2] = useState<string>("");

  const handleMtLoaded = useCallback((mt: Multitrack) => {
    multitrackRef.current = mt;
  }, []);

  const handleMtDestroy = useCallback(() => {
    multitrackRef.current = null;
  }, []);

  const handleToggle = useCallback(() => {
    const mt = multitrackRef.current;
    if (!mt) {
      return;
    }
    if (mt.isPlaying()) {
      mt.pause();
    } else {
      mt.play();
    }
  }, []);

  return (
    <div className={styles.wrapper}>
      <FileInput value={file1} onChange={setFile1} />
      <FileInput value={file2} onChange={setFile2} />
      <div>
        <button onClick={handleToggle}>toggle play</button>
        <WaveDiff
          sources={[file1, file2]}
          onMultiTrackLoaded={handleMtLoaded}
          onMultiTrackDestroy={handleMtDestroy}
        />
      </div>
    </div>
  );
}
