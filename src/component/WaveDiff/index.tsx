import { HTMLProps, ReactElement, useEffect, useRef, useState } from "react";
import "./multitrack.min.js";

export declare class Multitrack {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static create(tracks: any[], options: any): Multitrack;

  isPlaying(): boolean;

  play(): void;

  pause(): void;

  destroy(): void;
}

function randomColor(): string {
  return `hsl(${Math.random() * 360}, ${Math.random() * 100}%, ${Math.random() * 100}%)`;
}

export interface IWaveDiffProps extends HTMLProps<HTMLDivElement> {
  sources?: string[];
  onMultiTrackLoaded?: (multitrack: Multitrack) => void;
  onMultiTrackDestroy?: () => void;
}

export default function WaveDiff({
  sources,
  onMultiTrackLoaded,
  onMultiTrackDestroy,
  ...props
}: IWaveDiffProps): ReactElement {
  const loadedSources = useRef<string[]>([]);

  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container || !sources) {
      return;
    }

    const filtered = sources.filter((i) => !!i);
    if (!filtered.length) {
      return;
    }

    // no change
    if (
      loadedSources.current.length === filtered.length &&
      !loadedSources.current.find((s, i) => s !== sources[i])
    ) {
      return;
    }

    loadedSources.current = filtered;

    const multitrack = Multitrack.create(
      filtered.map((src, index) => ({
        id: index,
        draggable: false,
        url: src,
        volume: 1 / filtered.length,
        options: {
          waveColor: randomColor(),
          progressColor: randomColor(),
        },
      })),
      {
        container,
        minPxPerSec: 100,
        rightButtonDrag: true,
        cursorWidth: 2,
        cursorColor: "#D72F21",
        trackBackground: "#2D2D2D",
        trackBorderColor: "#7C7C7C",
        dragBounds: true,
      },
    );

    onMultiTrackLoaded?.(multitrack);

    return () => {
      multitrack.destroy();
      onMultiTrackDestroy?.();
    };
  }, [container, onMultiTrackDestroy, onMultiTrackLoaded, sources]);

  return (
    <div
      {...props}
      style={{ height: "300px", ...props.style }}
      ref={setContainer}
    ></div>
  );
}
