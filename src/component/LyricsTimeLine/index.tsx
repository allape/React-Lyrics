import { useProxy } from "@allape/use-loading";
import { ReactElement, useCallback, useEffect } from "react";
import { Region } from "wavesurfer.js/plugins/regions";
import { LyricsDriver } from "../../../index.ts";
import WaveForm, { IWaveFormProps } from "../Waveform";

export interface ILyricsTimeLineProps {
  src?: string;
  lyrics?: string;
}

export default function LyricsTimeLine({
  src,
  lyrics,
}: ILyricsTimeLineProps): ReactElement {
  const [regions, regionsRef, setRegions] = useProxy<
    Exclude<IWaveFormProps["regions"], undefined>
  >([]);

  useEffect(() => {
    if (!lyrics) return;

    const driver = LyricsDriver.parse(lyrics);
    driver.glueLine(-1, 250);

    const labels: IWaveFormProps["regions"] = [];
    let index = 0;

    driver.lines.forEach((line, li) => {
      line.syllables.forEach((syllable, si) => {
        labels.push({
          id: `${li}_${si}`,
          start: syllable.st / 1000,
          end: syllable.et / 1000,
          content: syllable.text,
          color:
            index++ % 2 === 0
              ? "rgba(0, 0, 0, 0.1)"
              : "rgba(255, 255, 255, 0.1)",
        });
      });
      labels.push({
        id: `newline_${li}`,
        start: line.et / 1000,
        end: line.et / 1000 + 0.05,
        color: "red",
      });
    });

    setRegions(labels);
  }, [lyrics, setRegions]);

  const handleExportRefinedLyrics = useCallback(() => {
    // TODO
  }, []);

  const handleRegionUpdate = useCallback(
    (region: Region) => {
      // pollute the region data, but NOT update the array address
      const found = regionsRef.current.find((i) => i.id === region.id);
      if (found) {
        found.start = region.start;
        found.end = region.end;
      }
    },
    [regionsRef],
  );

  return (
    <div>
      <WaveForm
        url={src}
        regions={regions}
        spectrogram={false}
        hover={false}
        onRegionUpdated={handleRegionUpdate}
      />
      <button onClick={handleExportRefinedLyrics}>Export Refined Lyrics</button>
    </div>
  );
}
