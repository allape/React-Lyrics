import { useProxy } from "@allape/use-loading";
import { getRoman } from "cantonese-romanisation";
import { ReactElement, useCallback, useEffect, useState } from "react";
import { toRomaji } from "wanakana";
import DroppableTextarea from "../../component/DroppableTextarea";
import Lyrics from "../../core/lyrics.ts";
import useSrcTextFromSearchParams from "../../hook/useSrcTextFromSearchParams.ts";
import styles from "./style.module.scss";

type ConversionType =
  | "Pure Text"
  | "Double Space Split"
  | "Cantonese Romanisation"
  | "Japanese Romaji";

type ConversionTypesHandler = (l: Lyrics) => string;

const ConversionTypesHandlers: Record<ConversionType, ConversionTypesHandler> =
  {
    "Pure Text": (l) => l.toString(),
    "Double Space Split": (l) => {
      return l.lines
        .map((line) => line.syllables.map((s) => s.text).join(" "))
        .join("\n");
    },
    // FIXME The third-part package does NOT convert all chars
    "Cantonese Romanisation": (l) => {
      return l.lines
        .map((line) =>
          line.syllables
            .map(
              (s) =>
                getRoman(s.text)
                  .map((jyutping) => jyutping.join("|"))
                  .join(" ")
                  .trim() || s.text,
            )
            .join(" "),
        )
        .join("\n");
    },
    "Japanese Romaji": (l) => {
      return l.lines
        .map((line) =>
          line.syllables.map((s) => toRomaji(s.text) || s.text).join(" "),
        )
        .join("\n");
    },
  };

const ConversionTypes = Object.keys(ConversionTypesHandlers);

export default function SyllableSwapper(): ReactElement {
  const { text: textFromSP } = useSrcTextFromSearchParams();

  const [text, textRef, setText] = useProxy<string | undefined>(undefined);
  const [message, setMessage] = useState<string>();

  const [conversion, setConversion] = useState<string>();
  const [conversionType, setConversionType] =
    useState<ConversionType>("Pure Text");

  const [candidate, candidateRef, setCandidate] = useProxy<string>("");
  const [result /*resultRef*/, , setResult] = useProxy<string>("");

  useEffect(() => {
    if (!text) {
      setConversion("");
      return;
    }

    try {
      const l = Lyrics.parse(text);
      setConversion(ConversionTypesHandlers[conversionType](l));
    } catch (e) {
      console.error(e);
    }
  }, [conversionType, text]);

  useEffect(() => {
    if (textFromSP) {
      setText(textFromSP);
    }
  }, [setText, textFromSP]);

  const handleReplace = useCallback(() => {
    if (!textRef.current) {
      setMessage("No Lyrics Loaded");
      return;
    }

    const lines = candidateRef.current
      .split("\n")
      .map((i) => i.trim())
      .filter(Boolean);

    let l: Lyrics;

    try {
      l = Lyrics.parse(textRef.current);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unknow Error");
      return;
    }

    if (lines.length !== l.lines.length) {
      setMessage("Line count is mismatch");
      return;
    }

    lines.forEach((line, i) => {
      const syllables = line.match(/[^ ]+ */gi);
      if (!syllables || syllables.length !== l.lines[i].syllables.length) {
        setMessage(
          `Line of ${i + 1} mismatch: [${syllables?.join(" ")}] != ${l.lines[i].syllables.map((s) => s.text).join(" ")}`,
        );
        return;
      }

      syllables.forEach((syllable, si) => {
        const leadingSpace = syllable.startsWith("  ") ? " " : "";
        const endingSpace = syllable.endsWith("  ") ? " " : "";
        l.lines[i].syllables[si].text =
          `${leadingSpace}${syllable.trim()}${endingSpace}`;
      });
    });

    setResult(l.save());
    setMessage("");
  }, [candidateRef, setResult, textRef]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.source}>
        <DroppableTextarea
          className={styles.text}
          rows={10}
          placeholder="Add text or drop a LRC file here"
          value={text}
          onChange={setText}
        ></DroppableTextarea>
        <div className={styles.conversion}>
          <div className={styles.conversionType}>
            <select
              value={conversionType}
              onChange={(e) =>
                setConversionType(e.target.value as ConversionType)
              }
            >
              {ConversionTypes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.conversionResult}>
            {conversion || "No Lyrics Loaded"}
          </div>
        </div>
      </div>
      <div className={styles.message}>{message || "Everything is Okay!"}</div>
      <div className={styles.swapper}>
        <div className={styles.candidate}>
          <textarea
            placeholder="Replacement Candidate Text, seperated by space, double-space to insert a space"
            rows={20}
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
            onBlur={handleReplace}
          ></textarea>
        </div>
        <div className={styles.result}>
          <textarea
            readOnly
            placeholder="Replaced Result"
            rows={20}
            value={result}
            onChange={(e) => setResult(e.target.value)}
          ></textarea>
        </div>
      </div>
    </div>
  );
}
