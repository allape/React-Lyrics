import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import { TimePoint } from "../core/lyrics.ts";

export default function useRAFAudioTime(
  audioRef: MutableRefObject<HTMLAudioElement | null>,
): [TimePoint, Dispatch<SetStateAction<TimePoint>>] {
  const [current, setCurrent] = useState<TimePoint>(0);

  useEffect(() => {
    let id = -1;
    const handleRequestAnimationFrame = () => {
      try {
        if (!audioRef.current) {
          return;
        }
        setCurrent(audioRef.current.currentTime * 1000);
      } finally {
        id = window.requestAnimationFrame(handleRequestAnimationFrame);
      }
    };
    handleRequestAnimationFrame();
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [audioRef]);

  return [current, setCurrent];
}
