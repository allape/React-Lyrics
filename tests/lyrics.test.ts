import Lyrics from '../src/core/lyrics';

/**
 * @see https://guoyunhe.github.io/rabbit-lyrics
 */
const Example = `
[00:00.00] 谁のことを考えてるの?
[00:03.10] ハートのスペース争夺戦
[00:05.76] 戦况的に 一进一退で
[00:10.56] 油断ならないな
[00:11.70] あのね 今のとこ ほんの数％しか
[00:16.73] アイツの心に 居场所がないんだ
`;

/**
 * @see https://en.wikipedia.org/wiki/LRC_(file_format)
 */
const ExampleLRC = `
[00:12.00]Line 1 lyrics
[00:17.20]Line 2 lyrics

[00:21.10][00:45.10]Repeating lyrics (e.g. chorus)
...
[mm:ss.xx]Last lyrics line
`

describe("test lyrics", () => {
  test("mmssSSSS", async () => {
    expect(Lyrics.fromStringTimePoint("[01]")).toBe(60_000);
    expect(Lyrics.fromStringTimePoint("[02:]")).toBe(120_000);
    expect(Lyrics.fromStringTimePoint("[03:00]")).toBe(180_000);
    expect(Lyrics.fromStringTimePoint("[03:01]")).toBe(181_000);
    expect(Lyrics.fromStringTimePoint("[03:02.]")).toBe(182_000);
    expect(Lyrics.fromStringTimePoint("[03:03.3]")).toBe(183_300);
    expect(Lyrics.fromStringTimePoint("[04:03.321]")).toBe(243_321);
    expect(Lyrics.fromStringTimePoint("5")).toBe(300_000);
    expect(Lyrics.fromStringTimePoint("5:1")).toBe(301_000);
    expect(Lyrics.fromStringTimePoint("5:1.111")).toBe(301_111);

    expect(Lyrics.fromStringTimePoint("6:abc")).toBe(0);
    expect(Lyrics.fromStringTimePoint("7:abc:123:abc")).toBe(0);
    expect(Lyrics.fromStringTimePoint("[05:00.abc]")).toBe(0);
    expect(Lyrics.fromStringTimePoint("abc")).toBe(0);
  });

  test("parse", () => {
    const l = Lyrics.parse(Example);
    expect(l.lines.length).toBe(6);
    expect(l.lines[0][0]).toBe(0);
    expect(l.lines[0][1]).toBe(3_100);
    expect(l.lines[0][2][0][0]).toBe(0);
    expect(l.lines[0][2][0][1]).toBe(3_100);
    expect(l.lines[0][2][0][2]).toBe(" 谁のことを考えてるの?");
    expect(l.lines[5][2][0][0]).toBe(16_730);
    expect(l.lines[5][2][0][1]).toBe(0);
    expect(l.lines[5][2][0][2]).toBe(" アイツの心に 居场所がないんだ");
    expect(l.lines[5][0]).toBe(16_730);
    expect(l.lines[5][1]).toBe(0);

    const l1 = l.getLinesByTimePoint(2_000)[0];
    expect(l1?.[0]).toBe(0);
    expect(l1?.[1]).toBe(3_100);
    expect(l1?.[2][0][2]).toBe(" 谁のことを考えてるの?");

    const l3 = l.getLinesByTimePoint(6_000)[0];
    expect(l3?.[0]).toBe(5_760);
    expect(l3?.[1]).toBe(10_560);
    expect(l3?.[2][0][2]).toBe(" 戦况的に 一进一退で");

    const l6 = l.getLinesByTimePoint(17_000)[0];
    expect(l6?.[0]).toBe(16_730);
    expect(l6?.[1]).toBe(0);
    expect(l6?.[2][0][2]).toBe(" アイツの心に 居场所がないんだ");

    expect(l.getLineIndexesByTimePoint(2_000)[0]).toBe(0);
    expect(l.getLineIndexesByTimePoint(17_000)[0]).toBe(5);

    expect(l.getLineStringsByTimePoint(2_000)[0]).toBe(" 谁のことを考えてるの?");
    expect(l.getLineStringsByTimePoint(17_000)[0]).toBe(" アイツの心に 居场所がないんだ");

    expect(l.getLineIndexesByTimePoint(-1).length).toBe(0);
    expect(l.getLineIndexesByTimePoint(-999).length).toBe(0);
    expect(l.getLineIndexesByTimePoint(999_999_999)[0]).toBe(5);
  });

  test("parseLRC", () => {
    const l1 = Lyrics.parseStandardLRC(ExampleLRC);

    expect(l1.lines.length).toBe(4)
    expect(l1.lines[0][0]).toBe(12_000);
    expect(l1.lines[3][0]).toBe(45_100);

    expect(l1.getLineIndexesByTimePoint(13_000)[0]).toBe(0);
    expect(l1.getLineIndexesByTimePoint(18_000)[0]).toBe(1);
    expect(l1.getLineIndexesByTimePoint(22_000)[0]).toBe(2);
    expect(l1.getLineIndexesByTimePoint(46_000)[0]).toBe(3);
    expect(l1.getLineIndexesByTimePoint(50_000)[0]).toBe(3);
  })
});

