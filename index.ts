export { default as LyricsDriver } from "./src/core/lyrics";
export type * from "./src/core/lyrics";

export { default as Lyrics, type ILyricsProps } from "./src/component/Lyrics";

export {
  default as LyricsEditor,
  DefaultWordSplitterRegexp,
  type ILyricsEditorProps,
} from "./src/component/LyricsEditor";

export { default as useRAFAudioTime } from "./src/hook/useRAFAudioTime";
