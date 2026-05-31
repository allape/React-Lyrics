import { useProxy } from "@allape/use-loading";
import { ReactElement, useCallback, useEffect } from "react";
import styles from "./style.module.scss";

export default function Replacer(): ReactElement {
  const [matcher, matcherRef, setMatcher] = useProxy<string>(
    "\\[\\d+:\\d+(\\.\\d+)?\\]",
  );
  const [replacement, replacementRef, setReplacement] =
    useProxy<string>("[00:00.01]");

  const [source, sourceRef, setSource] = useProxy<string>("");
  const [result, resultRef, setResult] = useProxy<string>("");

  const handleReplace = useCallback(() => {
    if (!matcherRef.current) {
      setResult("(Text to Match is empty)");
      return;
    }

    if (!replacementRef.current) {
      setResult("(Text to Replace is empty)");
      return;
    }

    if (matcherRef.current === replacementRef.current) {
      setResult("(Text to Match and Text to Replace are the same)");
      return;
    }

    if (!sourceRef.current) {
      setResult("(Source Text is empty)");
      return;
    }

    try {
      const regexp = new RegExp(matcherRef.current, "g");
      setResult(sourceRef.current.replace(regexp, replacementRef.current));
      return;
    } catch (e) {
      console.error(matcherRef.current, "is not a regexp:", e);
    }

    console.log("fallback to string replace");
    let res = sourceRef.current;
    while (true) {
      const index = res.indexOf(matcherRef.current);
      if (index === -1) {
        break;
      }
      // res = res.replace(matcherRef.current, replacementRef.current);
      res =
        res.substring(0, index) +
        replacementRef.current +
        res.substring(index + replacementRef.current.length);
    }

    setResult(res);
  }, [matcherRef, replacementRef, setResult, sourceRef]);

  const handleCopyResult = useCallback(() => {
    if (!resultRef.current) {
      return;
    }
    (async () => {
      await navigator.clipboard.writeText(resultRef.current);
    })();
  }, [resultRef]);

  useEffect(() => {
    handleReplace();
  }, [handleReplace, matcher, replacement, source]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <input
          className={styles.col}
          type="text"
          placeholder="Text or Regexp to Match"
          title="Text or Regexp to Match"
          value={matcher}
          onChange={(e) => setMatcher(e.target.value)}
          onBlur={handleReplace}
        />
        <input
          className={styles.col}
          type="text"
          placeholder="Text to Replace"
          title="Text to Replace"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onBlur={handleReplace}
        />
      </div>
      <div className={styles.row}>
        <textarea
          className={styles.col}
          placeholder="Source Text"
          title="Source Text"
          onBlur={handleReplace}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={20}
        />
        <textarea
          className={styles.col}
          readOnly
          placeholder="Readonly Result Text, Click to Copy"
          title="Readonly Result Text, Click to Copy"
          onClick={handleCopyResult}
          value={result}
          onChange={(e) => setResult(e.target.value)}
          rows={20}
        />
      </div>
    </div>
  );
}
