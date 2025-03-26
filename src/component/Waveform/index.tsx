import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { TimePoint } from "../../core/lyrics.ts";

export interface IWaveFormProps extends HTMLProps<HTMLDivElement> {
  url?: string;
  current?: TimePoint;
}

export default function WaveForm({
  url,
  current,
  ...props
}: IWaveFormProps): ReactElement {
  const surfer = useRef<WaveSurfer | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container || !url) {
      return;
    }

    const s = new WaveSurfer({
      container,
      url,
      waveColor: "#4F4A85",
      progressColor: "#383351",
      minPxPerSec: 100,
      autoScroll: true,
      autoCenter: true,
    });

    surfer.current = s;
    return () => {
      s.destroy();
    };
  }, [container, url]);

  useEffect(() => {
    if (!surfer.current) {
      return;
    }

    const time = (current || 0) / 1000;
    surfer.current.setTime(time);
    surfer.current.setScrollTime(time - surfer.current.getWidth() / 100 / 2);
  }, [current]);

  return (
    <div ref={setContainer} {...props}>
      {url ? undefined : <p style={{ textAlign: "center" }}>No Audio Load</p>}
    </div>
  );
}
