export type Millisecond = number;

export type TimePoint = Millisecond;

export type StartTimePoint = TimePoint;
export type EndTimePoint = TimePoint;

export type Syllable = {
  st: StartTimePoint;
  et: EndTimePoint;
  text: string;
  leadingSpace?: boolean;
  trailingSpace?: boolean;
};

export type Line = {
  rap?: boolean;
  harmony?: boolean;
  st: StartTimePoint;
  et: EndTimePoint;
  syllables: Syllable[];
};

export type Progress = 0 | 1 | number;

export default class Lyrics {
  public readonly lines: Line[] = [];

  /**
   * Glue lines with the gap less than diff, the previous end time point as the start time point of the next line
   * @param diff the gap between two lines, use negative number to glue all lines with no gap
   * @param syllableDiff the gap between two syllables, this number always equal to 0 or greater than 0
   */
  public glueLine(
    diff: Millisecond | -1 = -1,
    syllableDiff: Millisecond = 100,
  ): Line[] {
    syllableDiff = Math.max(0, syllableDiff);

    this.lines.forEach((line, index, lines) => {
      line.syllables.forEach((syllable, syllableIndex, syllables) => {
        if (syllableIndex === 0) {
          return;
        }

        const prevSyllable = syllables[syllableIndex - 1];
        if (syllableDiff >= Math.abs(syllable.st - prevSyllable.et)) {
          syllable.st = prevSyllable.et;
        }
      });

      if (index === 0) {
        return;
      }

      const prevLine = lines
        .slice(0, index)
        .reverse()
        .find((l) => l.st < line.st);

      if (!prevLine) {
        return;
      }

      const lineDiff = line.st - prevLine.et;

      if (lineDiff > 0 && (diff < 0 || lineDiff <= diff)) {
        line.st = prevLine.et;
      }
    });
    return this.lines;
  }

  public insertStartIndicator(
    gap: Millisecond = 5_000,
    indicators: string[] = [" ● ", " ● ", " ● "],
    fillRestGapWith: string = " ~  ~  ~ ",
  ): Line[] {
    const indicatorsDuration = indicators.length * 1000;
    if (indicatorsDuration > gap) {
      throw new Error("Indicator length should be less than gap / 1000");
    }

    const newLines: typeof this.lines = [];

    let lastEtp: EndTimePoint = 0;

    for (let i = 0; i < this.lines.length; i++) {
      if (i > 0) {
        lastEtp = this.lines[i - 1].et;
      }

      const cLine = this.lines[i];

      if (cLine.st - lastEtp >= gap) {
        const ls: TimePoint = cLine.st - indicatorsDuration;
        const le: TimePoint = cLine.st;
        if (fillRestGapWith) {
          newLines.push({
            st: lastEtp,
            et: ls,
            syllables: [
              {
                st: lastEtp,
                et: ls,
                ...Lyrics.partialSyllableFromText(fillRestGapWith),
              },
            ],
          });
        }

        if (indicators.length > 0) {
          newLines.push(
            {
              st: ls,
              et: le,
              syllables: indicators.map((i, index) => {
                const st = ls + index * 1000;
                const et = st + 1000;
                return {
                  st,
                  et,
                  ...Lyrics.partialSyllableFromText(i),
                };
              }),
            },
            cLine,
          );
        } else {
          newLines.push(cLine);
        }
      } else {
        newLines.push(cLine);
      }
    }

    this.lines.splice(0, this.lines.length, ...newLines);

    return newLines;
  }

  public getProgressesByTimePointInLine(
    tp: TimePoint,
    line: Line | number,
  ): Progress[] {
    if (typeof line === "number") {
      line = this.lines[line];
      if (!line) {
        return [];
      }
    }

    return line.syllables.map(({ st, et }) => {
      if (tp <= st) {
        return 0;
      } else if (tp >= et) {
        return 1;
      }

      return (tp - st) / (et - st);
    });
  }

  public getLinesByTimePoint(tp: TimePoint): Line[] {
    return this.getLineIndexesByTimePoint(tp).map((index) => this.lines[index]);
  }

  public getLineIndexesByTimePoint(tp: TimePoint): number[] {
    const indexes: number[] = [];
    this.lines.forEach((line, index) => {
      if (line.st <= tp && (line.et === 0 || tp < line.et)) {
        indexes.push(index);
      }
    });
    return indexes;
  }

  public getLineStringsByTimePoint(tp: TimePoint): string[] {
    return this.getLinesByTimePoint(tp).map((line) =>
      line.syllables.map((i) => i.text).join(""),
    );
  }

  public save(): string {
    return this.lines
      .map((line) =>
        line.syllables
          .map(({ st, et, text }) => {
            return `${Lyrics.toStringTimePoint(st)}${text}${et > 0 ? `${Lyrics.toStringTimePoint(et)}` : ""}`;
          })
          .join(""),
      )
      .join("\n");
  }

  public toString(): string {
    return this.lines
      .map((l) =>
        l.syllables
          .map((s) => s.text)
          .join("")
          .trim(),
      )
      .join("\n");
  }

  /**
   * Parse standard LRC format
   * @see https://en.wikipedia.org/wiki/LRC_(file_format)
   * @param text standard LRC format text
   */
  public static parseStandardLRC(text: string): Lyrics {
    if (!text?.trim()) return new Lyrics();
    const lines = text.split("\n").map((i) => i.trim());

    const formatted: string[] = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      const [, tps, words] = line.match(/((?:\[\d+:\d+\.\d+]\s*)+)(.+)/) || [];
      if (tps) {
        const timePoints = tps
          .split("]")
          .map((i) => i.trim())
          .filter((i) => !!i)
          .map((i) => `${i}]`);
        formatted.push(...timePoints.map((tp) => `${tp}${words}`));
      }
    });

    return this.parse(formatted.join("\n"));
  }

  /**
   * https://en.wikipedia.org/wiki/LRC_(file_format)
   * @param text LRC format text with word by word timestamp
   * ```
   * [00:00.00]Ly[00:00.20][00:00.21]ri[00:00.30][00:00.31]cs[00:00.40]
   * [00:00.00]歌[00:00.20]词[00:00.30]
   * ```
   */
  public static parse(text: string): Lyrics {
    text = text.trim();

    const lyrics = new Lyrics();

    if (!text) {
      return lyrics;
    }

    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      const syllables = this.parseLine(line);

      if (syllables.length === 0) {
        continue;
      }

      // the start time point of current line
      const lineStp = syllables[0].st;
      const lineEtp = syllables[syllables.length - 1].et;

      if (lyrics.lines.length > 0) {
        const prevLine = lyrics.lines[lyrics.lines.length - 1];
        // use the start time point of the first syllable of current line
        //     to fill the end time of the last syllable of prev line
        if (prevLine.syllables.length > 0) {
          const lastSyllableOfPrevLine =
            prevLine.syllables[prevLine.syllables.length - 1];
          if (!lastSyllableOfPrevLine.et) {
            lastSyllableOfPrevLine.et = lineStp || 0;
          }
        }
        // use the start time point of current line to fill the end time of the prev line
        if (!prevLine.et) {
          prevLine.et = lineStp;
        }
      }

      lyrics.lines.push({
        harmony: line.startsWith("harmony:"),
        rap: line.startsWith("rap:"),
        st: lineStp,
        et: lineEtp,
        syllables: syllables,
      });
    }

    // sort by start time point asc
    lyrics.lines.sort((a, b) => a.st - b.st);

    return lyrics;
  }

  public static parseLine(line: string): Syllable[] {
    const syllables: Syllable[] = [];

    let failSafeIndex = 0;
    while (line.length > 0) {
      if (++failSafeIndex > 1000) {
        break;
      }

      const [full /*type*/, , st, syllable, et, nextSt] =
        line
          .trim()
          .match(
            /^(?:(harmony|rap):\s*)?(\[\d+:\d+(?:\.\d+)?])([^[]*)(\[\d+:\d+(?:\.\d+)?])?(\[\d+:\d+(?:\.\d+)?])?/,
          ) || [];
      if (!full || !st) {
        break;
      }

      let cutIndex = full.length;
      if (nextSt && et) {
        cutIndex = full.length - nextSt.length;
      } else if (!nextSt && et) {
        cutIndex = full.length - et.length;
      }

      line = line.substring(cutIndex);

      const stp = this.fromStringTimePoint(st);
      if (isNaN(stp)) {
        continue;
      }

      const etp = this.fromStringTimePoint(et);

      // use the start time point of current syllable to fill the end time of the prev syllable
      const prevSyllable = syllables[syllables.length - 1];
      if (prevSyllable && !prevSyllable.et) {
        prevSyllable.et = stp;
      }

      if (syllable) {
        syllables.push({
          st: stp,
          et: etp || 0,
          ...Lyrics.partialSyllableFromText(syllable),
        });
      }
    }

    // sort by start time point asc
    syllables.sort((a, b) => a.st - b.st);

    return syllables;
  }

  /**
   * [mm:ss.SS(SS)?] to millisecond
   */
  public static fromStringTimePoint(time: string): TimePoint {
    if (!time) return 0;

    const [, m, s] = time.match(/^\[?(\d+):?(\d+(?:\.\d*)?)?]?$/) || [];

    let tp = 0;

    if (m) {
      tp += parseInt(m) * 60 * 1000;
    }
    if (s) {
      tp += parseFloat(s) * 1000;
    }

    return tp;
  }

  /**
   * {@link TimePoint} to [mm:ss.SS]
   * @param tp
   */
  public static toStringTimePoint(tp: TimePoint): string {
    const m = Math.floor(tp / 60_000);
    const s = (tp % 60_000) / 1000;
    return `[${`${m}`.padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}]`;
  }

  public static partialSyllableFromText(
    text: string,
  ): Required<Pick<Syllable, "text" | "leadingSpace" | "trailingSpace">> {
    return {
      text,
      leadingSpace: text.startsWith(" "),
      trailingSpace: text.endsWith(" "),
    };
  }
}
