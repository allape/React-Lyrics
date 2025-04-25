import { ReactElement, useMemo, useState } from "react";
import { LyricsText, OGG } from "../../example/LInternationale.ts";
import { ILV } from "../../helper/lv.ts";
import SimplePlayer from "../SimplePlayer";
import styles from "./style.module.scss";

interface ILyricsLV extends ILV {
  karaoke: boolean;
}

const LyricsOptions: ILyricsLV[] = [
  {
    karaoke: true,
    label: "Karaoke Mode",
    value: `Karaoke Mode\n${LyricsText}`,
  },
  {
    karaoke: false,
    label: "Normal Mode",
    value: `Normal Mode\n${LyricsText}`,
  },
];

export default function Demo(): ReactElement {
  const [content, setContent] = useState<string>(() => LyricsOptions[0].value);

  const karaoke = useMemo(
    () => LyricsOptions.find((o) => o.value === content)?.karaoke,
    [content],
  );

  return (
    <div className={styles.wrapper}>
      <SimplePlayer url={OGG} karaoke={karaoke} content={content} />
      <select
        className={styles.selector}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      >
        {LyricsOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
