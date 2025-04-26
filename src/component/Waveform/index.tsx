import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import WaveSurfer, { WaveSurferOptions } from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import Spectrogram from "wavesurfer.js/dist/plugins/spectrogram.esm.js";
import { Region, RegionParams } from "wavesurfer.js/plugins/regions";

export interface IRegionParams extends RegionParams {
  hoverColor?: string;
  activeColor?: string;
}

export interface IWaveFormProps extends HTMLProps<HTMLDivElement> {
  url?: string;
  spectrogram?: boolean;
  hover?: boolean;
  regions?: IRegionParams[];
  options?: Omit<WaveSurferOptions, "container" | "url">;
  onAudioLoaded?: (waveSurfer: WaveSurfer) => void;
  onRegionUpdated?: (region: Region) => void;
}

export default function WaveForm({
  url,
  spectrogram = true,
  hover = true,
  regions,
  options,
  onAudioLoaded,
  onRegionUpdated,
  ...props
}: IWaveFormProps): ReactElement {
  const surfer = useRef<WaveSurfer | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container || !url) {
      return;
    }

    const regionPlugin = RegionsPlugin.create();

    const s = new WaveSurfer({
      container,
      url,
      waveColor: "#4F4A85",
      progressColor: "#383351",
      minPxPerSec: 100,
      autoScroll: true,
      autoCenter: true,
      mediaControls: true,
      plugins: [regionPlugin],
      ...options,
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
      if (!regions) {
        return;
      }

      const setActiveColor = (region: Region, active: boolean) => {
        const param = regions.find((p) => p.id === region.id);
        if (!param || !param.activeColor) {
          return;
        }

        region.setOptions({
          color: active ? param.activeColor || param.color : param.color,
        });
      };

      regionPlugin.on("region-in", (region: Region) => {
        setActiveColor(region, true);
      });
      regionPlugin.on("region-out", (region: Region) => {
        setActiveColor(region, false);
      });

      regions.forEach((param) => {
        const r = regionPlugin.addRegion(param);
        r.on("over", () => {
          r.setOptions({
            color: param.hoverColor || param.color,
          });
        });
        r.on("leave", () => {
          const now = s.getCurrentTime();
          if (now >= r.start && now <= r.end && param.activeColor) {
            return;
          }
          r.setOptions({
            color: param.color,
          });
        });
      });
    });

    regionPlugin.on("region-updated", (region) => {
      onRegionUpdated?.(region);
    });

    surfer.current = s;

    onAudioLoaded?.(s);

    return () => {
      s.destroy();
      regionPlugin.destroy();
    };
  }, [
    container,
    hover,
    onAudioLoaded,
    onRegionUpdated,
    regions,
    spectrogram,
    url,
    options,
  ]);

  return (
    <div ref={setContainer} {...props}>
      {url ? undefined : <p style={{ textAlign: "center" }}>No Audio Load</p>}
    </div>
  );
}
