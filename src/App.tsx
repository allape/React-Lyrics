import { ReactElement, useCallback, useEffect, useState } from "react";
import { ILV } from "./helper/lv.ts";
import styles from "./style.module.scss";
import Demo from "./view/Demo";
import LyricsCreatorDemo from "./view/LyricsCreatorDemo";
import LyricsTimeLineDemo from "./view/LyricsTimeLineDemo";
import SimplePlayer from "./view/SimplePlayer";
import WaveDiffDemo from "./view/WaveDiffDemo";

type Route =
  | "demo"
  | "lyrics-creator"
  | "simple-player"
  | "lyrics-timeline"
  | "wave-diff";

const Routers: ILV<Route>[] = [
  {
    label: "Demo",
    value: "demo",
  },
  {
    label: "Simple Player",
    value: "simple-player",
  },
  {
    label: "Lyrics Creator",
    value: "lyrics-creator",
  },
  {
    label: "Lyrics Timeline",
    value: "lyrics-timeline",
  },
  {
    label: "Audio Wave Diff",
    value: "wave-diff",
  },
];

const DefaultRoute = Routers[0].value;

export default function App(): ReactElement {
  const [route, setRoute] = useState<Route | undefined>(undefined);

  const handleChange = useCallback((u: URL) => {
    setRoute((u.hash.substring(1) || DefaultRoute) as Route);
  }, []);

  useEffect(() => {
    const handleHashChange = (e: HashChangeEvent) => {
      e.preventDefault();
      handleChange(new URL(e.newURL));
    };

    handleChange(new URL(window.location.href));

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [handleChange]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.navigator}>
        {Routers.map((router) => (
          <a
            key={router.value}
            className={styles.route}
            href={`#${router.value}`}
          >
            {router.label}
          </a>
        ))}
      </div>
      <div className={styles.slot}>
        {route === "demo" && <Demo />}
        {route === "simple-player" && <SimplePlayer />}
        {route === "lyrics-creator" && <LyricsCreatorDemo />}
        {route === "lyrics-timeline" && <LyricsTimeLineDemo />}
        {route === "wave-diff" && <WaveDiffDemo />}
      </div>
    </div>
  );
}
