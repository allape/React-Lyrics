import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { TimePoint } from "../core/lyrics.ts";

export default function useRAFAudioTime(
  audio: HTMLAudioElement | null,
): [TimePoint, Dispatch<SetStateAction<TimePoint>>] {
  const [current, setCurrent] = useState<TimePoint>(0);

  useEffect(() => {
    if (!audio) {
      setCurrent(0);
      return;
    }

    let id = -1;

    const handleRequestAnimationFrame = () => {
      try {
        setCurrent(audio.currentTime * 1000);
      } finally {
        id = window.requestAnimationFrame(handleRequestAnimationFrame);
      }
    };

    if (!audio.paused) {
      handleRequestAnimationFrame();
    }

    const handlePlay = () => {
      handleRequestAnimationFrame();
    };

    const handlePause = () => {
      window.cancelAnimationFrame(id);
    };

    const handleTimeUpdate = () => {
      if (audio.paused) {
        setCurrent(audio.currentTime * 1000);
      }
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("stop", handlePause);
    audio.addEventListener("ended", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      window.cancelAnimationFrame(id);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("stop", handlePause);
      audio.removeEventListener("ended", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [audio]);

  return [current, setCurrent];
}
