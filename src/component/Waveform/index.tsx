import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import WaveSurfer, { WaveSurferOptions } from "wavesurfer.js";

export interface IWaveFormProps extends HTMLProps<HTMLDivElement> {
  url?: string;
  waveOptions?: Omit<WaveSurferOptions, "container" | "url">;
  onAudioLoaded?: (waveSurfer: WaveSurfer) => void;
}

export default function WaveForm({
  url,
  waveOptions,
  onAudioLoaded,
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
      mediaControls: true,
      ...waveOptions,
    });

    surfer.current = s;

    onAudioLoaded?.(s);

    return () => {
      s.destroy();
    };
  }, [container, onAudioLoaded, url, waveOptions]);

  return (
    <div ref={setContainer} {...props}>
      {url ? undefined : <p style={{ textAlign: "center" }}>No Audio Load</p>}
    </div>
  );
}
