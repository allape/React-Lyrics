export { default as LyricsDriver } from "./src/core/lyrics";
export type * from "./src/core/lyrics";

export { default as Lyrics, type ILyricsProps } from "./src/component/Lyrics";

export {
  default as LyricsCreator,
  WordSplitterRegexps,
  type ILyricsCreatorProps,
} from "./src/component/LyricsCreator";

export {
  default as Waveform,
  type IWaveFormProps,
} from "./src/component/Waveform";

export { default as useRAFAudioTime } from "./src/hook/useRAFAudioTime";
