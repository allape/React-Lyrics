import { ReactElement, useCallback, useEffect, useState } from "react";
import LyricsCreator from "./component/LyricsCreator";
import { ILV } from "./helper/lv.ts";
import styles from "./style.module.scss";
import Demo from "./view/Demo";
import SimplePlayer from "./view/SimplePlayer";

type Route = "demo" | "lyrics-creator" | "simple-player";

const Routers: ILV<Route>[] = [
  {
    label: "Demo",
    value: "demo",
  },
  {
    label: "Lyrics Creator",
    value: "lyrics-creator",
  },
  {
    label: "Simple Player",
    value: "simple-player",
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
        {route === "lyrics-creator" && (
          <>
            <div className={styles.lyricsCreator}>
              <p>
                <code>[→] / [d] / [Enter]</code> to go to next syllable, hold it
                press down for a long breath syllable;
              </p>
              <p>
                <code>[↓] / [s]</code> to go to next line;
              </p>
              <p>
                <code>[←] / [a]</code> to clear current line and seek audio
                backwards for a while;
              </p>
              <p>
                <code>[↑] / [w]</code> to go back one line;
              </p>
              <p>
                <code>[Space]</code> to toggle audio;
              </p>
              <p>
                <code>[Esc]</code> to focus lyrics recorder;
              </p>
              <p>
                <code>[Shift]+[Any Arrow Key]</code> to seek audio
                forwards/backwards.
              </p>
            </div>
            <LyricsCreator />
          </>
        )}
        {route === "simple-player" && <SimplePlayer />}
      </div>
    </div>
  );
}
