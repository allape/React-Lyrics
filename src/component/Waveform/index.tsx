import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import ZoomPlugin from "wavesurfer.js/plugins/zoom";
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
    });

    s.registerPlugin(
      ZoomPlugin.create({
        scale: 0.5,
        maxZoom: 100,
      }),
    );

    surfer.current = s;
    return () => {
      s.destroy();
    };
  }, [container, url]);

  useEffect(() => {
    if (!surfer.current) {
      return;
    }

    surfer.current.setTime((current || 0) / 1000);
  }, [current]);

  return <div ref={setContainer} {...props}></div>;
}
