export { default as LyricsDriver } from "./src/core/lyrics";
export type * from "./src/core/lyrics";

export { default as Lyrics, type ILyricsProps } from "./src/component/Lyrics";

export {
  default as LyricsCreator,
  DefaultWordSplitterRegexp,
  type ILyricsCreatorProps,
} from "./src/component/LyricsCreator";

export {
  default as Waveform,
  type IWaveFormProps,
} from "./src/component/Waveform";

export { default as useRAFAudioTime } from "./src/hook/useRAFAudioTime";
export { LyricsText } from './src/example/LInternationale.ts';
export { OGG } from "./src/example/LInternationale.ts";
