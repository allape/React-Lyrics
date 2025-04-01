import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import WaveSurfer, { WaveSurferOptions } from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import Spectrogram from "wavesurfer.js/dist/plugins/spectrogram.esm.js";

export interface IWaveFormProps extends HTMLProps<HTMLDivElement> {
  url?: string;
  spectrogram?: boolean;
  hover?: boolean;
  waveOptions?: Omit<WaveSurferOptions, "container" | "url">;
  onAudioLoaded?: (waveSurfer: WaveSurfer) => void;
}

export default function WaveForm({
  url,
  spectrogram = true,
  hover = true,
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
    s.getMediaElement().style.marginTop = "10px";

    if (hover) {
      s.registerPlugin(
        Hover.create({
          lineColor: "#ff0000",
          lineWidth: 2,
          labelBackground: "#555",
          labelColor: "#fff",
        }),
      );
    }

    if (spectrogram) {
      s.registerPlugin(
        Spectrogram.create({
          labels: true,
          height: 200,
          splitChannels: true,
          scale: "mel", // or 'linear', 'logarithmic', 'bark', 'erb'
          frequencyMax: 8000,
          frequencyMin: 0,
          fftSamples: 1024,
          labelsBackground: "rgba(0, 0, 0, 0.1)",
        }),
      );
    }

    surfer.current = s;

    onAudioLoaded?.(s);

    return () => {
      s.destroy();
    };
  }, [container, hover, onAudioLoaded, spectrogram, url, waveOptions]);

  return (
    <div ref={setContainer} {...props}>
      {url ? undefined : <p style={{ textAlign: "center" }}>No Audio Load</p>}
    </div>
  );
}
