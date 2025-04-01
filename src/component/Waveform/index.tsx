import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import WaveSurfer, { WaveSurferOptions } from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import Spectrogram from "wavesurfer.js/dist/plugins/spectrogram.esm.js";
import { RegionParams } from "wavesurfer.js/plugins/regions";

const RegionsP = RegionsPlugin.create();

export interface IWaveFormProps extends HTMLProps<HTMLDivElement> {
  url?: string;
  spectrogram?: boolean;
  hover?: boolean;
  regions?: RegionParams[];
  waveOptions?: Omit<WaveSurferOptions, "container" | "url">;
  onAudioLoaded?: (waveSurfer: WaveSurfer) => void;
}

export default function WaveForm({
  url,
  spectrogram = true,
  hover = true,
  regions,
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
      plugins: [RegionsP],
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

    s.on("decode", () => {
      regions?.forEach((region) => {
        RegionsP.addRegion(region);
      });
    });

    surfer.current = s;

    onAudioLoaded?.(s);

    return () => {
      s.destroy();
    };
  }, [container, hover, onAudioLoaded, regions, spectrogram, url, waveOptions]);

  return (
    <div ref={setContainer} {...props}>
      {url ? undefined : <p style={{ textAlign: "center" }}>No Audio Load</p>}
    </div>
  );
}
