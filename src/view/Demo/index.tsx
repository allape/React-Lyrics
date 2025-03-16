import { useProxy } from "@allape/use-loading";
import { ReactElement, useCallback, useMemo, useState } from "react";
import Lyrics from "../../component/Lyrics";
import { TimePoint } from "../../core/lyrics.ts";
import { ILV } from "../../helper/lv.ts";
import useRAFAudioTime from "../../hook/useRAFAudioTime.ts";
import styles from "./style.module.scss";

interface ILyricsLV extends ILV {
  karaoke: boolean;
}

const LyricsOptions: ILyricsLV[] = [
  {
    karaoke: false,
    label: "Normal Mode",
    value: `[00:00.00]谁のことを考えてるの?[00:03.10]
[00:03.10]ハートのスペース争夺戦[00:05.76]
[00:05.76]戦况的に 一进一退で[00:10.56]
[00:10.56]油断ならないな[00:11.70]
[00:11.70]あのね 今のとこ ほんの数％しか[00:16.73]
[00:16.73]アイツの心に 居场所がないんだ[00:21.38]
[00:21.51]制服のポケット[00:24.05]
[00:24.05]ホンネを忍ばせて[00:26.71]
[00:26.71]そっと えりを正す[00:31.71]
[00:31.71]そんな简単には[00:34.38]
[00:34.38]手の内 明かせない[00:36.90]
[00:36.90]あくまでまだ 様子见の段阶[00:41.81]
[00:42.01]だけど本当はね[00:44.59]
[00:44.59]见破って欲しいの[00:47.25]
[00:47.25]淡い期待に胸 ときめかして[00:51.74]
[00:51.74]チラチラと见てる[00:54.97]
[00:56.09]オンナノコの大事なモノ(意地悪で)[00:58.73]
[00:58.73]オトコノコの大事なコト(ムカつく)[01:01.53]
[01:01.53]引くに引けない それぞれの事情[01:06.26]
[01:06.26]ほかに何も考えらんない(真っ直ぐで)[01:09.03]
[01:09.03]一瞬だって よそ见できない(ニブいね)[01:11.68]
[01:11.68]充実感 あふれるほどに[01:16.25]
[01:16.25]満たしてあげるよ[01:17.32]
[01:17.32]条件ちらつかせ 様子うかがって见てる[01:22.50]
[01:22.50]お互いWin-Winな トリヒキしようよ[01:27.20]
[01:27.33]魔法少女だって[01:29.87]
[01:29.87]地底の民だって[01:32.60]
[01:32.60]悩むとこは同じ[01:37.71]
[01:37.71]异星の姫だって[01:40.13]
[01:40.13]オバケの少女だって[01:42.71]
[01:42.71]ドキドキして みんな恋をする[01:47.99]
[01:47.99]好きなタイプだとか[01:50.51]
[01:50.51]理想の告白を[01:53.21]
[01:53.21]思い描いた时[01:55.66]
[01:55.66]谁の颜が浮かんできちゃうの?![02:01.82]
[02:01.82]突然 チカラ涌いてきたり(不思议だよ)[02:04.46]
[02:04.46]ホロリ 优しさが染みたり(なぜなの)[02:07.15]
[02:07.15]それは全部 谁のせいかな[02:12.04]
[02:12.04]ライバルには负けたくない(それなのに)[02:14.74]
[02:14.74]だけどアイツには胜てない(なぜなの)[02:17.47]
[02:17.47]それってちょっと问题あるけど[02:22.15]
[02:22.15]もう手遅れだね[02:25.56]
[02:45.74]オンナノコの大事なモノ(意地悪で)[02:48.20]
[02:48.20]オトコノコの大事なコト(ムカつく)[02:51.02]
[02:51.02]引くに引けない それぞれの事情[02:55.95]
[02:55.95]ほかに何も考えらんない(真っ直ぐで)[02:58.67]
[02:58.67]一瞬だって よそ见できない(ニブいね)[03:01.31]
[03:01.31]充実感 あふれるほどに[03:06.01]
[03:06.01]満たしてあげるよ[03:07.02]
[03:07.02]条件ちらつかせ 様子うかがって[03:11.54]
[03:11.54]そんな感じの トリヒキしようよ[03:17.42]
[03:17.42]あのね今のとこ ほんの数％しか[03:22.48]
[03:22.48]アイツの心に 居场所がないんだ[03:27.19]

[00:00.00]究竟在想谁的事情呢？[00:03.10]
[00:03.10]心的位置争夺战[00:05.76]
[00:05.76]就戰況而言 一進一退[00:10.56]
[00:10.56]不可以大意[00:11.70]
[00:11.70]其實呀 現在只佔據少數幾％位置[00:16.73]
[00:16.73]在他的心中根本沒有棲身之所[00:21.38]
[00:21.51]制服的口袋裡[00:24.05]
[00:24.05]隱藏了真心的話語[00:26.71]
[00:26.71]悄悄地 整理衣領[00:31.71]
[00:31.71]怎麼可能會如此簡單[00:34.38]
[00:34.38]瞭解他緊握著的話語[00:36.90]
[00:36.90]到最後還是只能在遠處觀望的階段[00:41.81]
[00:42.01]但是實際上是[00:44.59]
[00:44.59]非常想要看清一切[00:47.25]
[00:47.25]懷著些許期待的內心 不斷鼓動著[00:51.74]
[00:51.74]躲躲藏藏地偷看著[00:54.97]
[00:56.09]女孩子最重要的東西（不懷好意地）[00:58.73]
[00:58.73]男孩子最重要的事情（令人生氣）[01:01.53]
[01:01.53]進退兩難的 許多事情[01:06.26]
[01:06.26]其他什麼的就不用多考慮了（勇往直前地）[01:09.03]
[01:09.03]只是一瞬間 卻還不看過來（太遲鈍了）[01:11.68]
[01:11.68]充實感就像滿溢出來似地[01:16.25]
[01:16.25]漸漸滿足了我[01:17.32]
[01:17.32]說出條件吧 再稍微觀察狀況吧[01:22.50]
[01:22.50]彼此都是win-win 接受這份交易吧[01:27.20]
[01:27.33]就算是魔法少女[01:29.87]
[01:29.87]就算是地底人[01:32.60]
[01:32.60]煩惱的事情也都一樣[01:37.71]
[01:37.71]就算是異星公主[01:40.13]
[01:40.13]就算是幽靈少女[01:42.71]
[01:42.71]大家心跳都撲通撲通地戀愛了[01:47.99]
[01:47.99]喜歡什麼類型之類的[01:50.51]
[01:50.51]想像著最理想[01:53.21]
[01:53.21]的告白時機[01:55.66]
[01:55.66]會是誰的臉龐浮現在腦海中呢？！[02:01.82]
[02:01.82]突然間 力量不斷地湧出（真是不可思議）[02:04.46]
[02:04.46]感人的 溫柔感染著眼眶（為什麼呢）[02:07.15]
[02:07.15]這些全部都是誰的責任呢？[02:12.04]
[02:12.04]身為對手的我是不會認輸的（即使這樣）[02:14.74]
[02:14.74]但是與那傢伙為敵是贏不了的（為什麼呢）[02:17.47]
[02:17.47]那麼樣這是不是有些問題呢？[02:22.15]
[02:22.15]已經來不及了[02:25.56]
[02:45.74]女孩子最重要的東西（不懷好意地）[02:48.20]
[02:48.20]男孩子最重要的事情（令人生氣）[02:51.02]
[02:51.02]進退兩難的 許多事情[02:55.95]
[02:55.95]其他什麼的就不用多考慮了（勇往直前地）[02:58.67]
[02:58.67]只是一瞬間 卻還不看過來（太遲鈍了）[03:01.31]
[03:01.31]充實感就像滿溢出來似地[03:06.01]
[03:06.01]漸漸滿足了我[03:07.02]
[03:07.02]說出條件吧 再稍微觀察狀況吧[03:11.54]
[03:11.54]去感受這樣的感覺 接受這份交易吧[03:17.42]
[03:17.42]其實呀 現在只佔據少數幾％位置[03:22.48]
[03:22.48]在他的心中根本沒有棲身之所[03:27.19]

[00:00.00]da re no ko to wo ka n ga e te ru no?[00:03.10]
[00:03.10]haato no supeesu so u da tsu se n[00:05.76]
[00:05.76]ze n ryo u te ki ni i sshi n i tta i de[00:10.56]
[00:10.56]yu u da n na ra na i na[00:11.70]
[00:11.70]a no ne i ma no to ko ho n no ka zu percent shi ka[00:16.73]
[00:16.73]aitsu no ko ko ro ni i ba sho ga na i n da[00:21.38]
[00:21.51]se i fu ku no pokeeto[00:24.05]
[00:24.05]ho n ne wo shi no ba se te[00:26.71]
[00:26.71]so tto e ri wo ta da su[00:31.71]
[00:31.71]so n na ka n ta n ni wa[00:34.38]
[00:34.38]te no chi a ka se na i[00:36.90]
[00:36.90]a ku ma de ma da yo u su mi no da n ka i[00:41.81]
[00:42.01]da ke do ho n to u wa ne[00:44.59]
[00:44.59]mi ya bu tte ho shi i no[00:47.25]
[00:47.25]a wa i ki ta i ni mu ne to ki me ka shi te[00:51.74]
[00:51.74]chira chira to mi te ru[00:54.97]
[00:56.09]onna no ko no da i ji na mono (i ji wa ru de)[00:58.73]
[00:58.73]otoko no ko no da i ji na koto (mu ka tsu ku)[01:01.53]
[01:01.53]hi ku ni hi ke na i so re zo re no ji jyo u[01:06.26]
[01:06.26]ho ka ni na ni mo ka n ga e ra n na i (ma ssu gu gu de)[01:09.03]
[01:09.03]i sshu n da tte yo so mi de ki na i (ni bu i ne)[01:11.68]
[01:11.68]jyu u ji tsu ka n a fu re ru ho do ni[01:16.25]
[01:16.25]mi ta shi te a ge ru yo[01:17.32]
[01:17.32]jyo u ke n chi ra tsu ka se yo u su u ka ga tte mi te ru[01:22.50]
[01:22.50]o ta ga i win-win na tori hiki shi n yo u yo[01:27.20]
[01:27.33]ma ho u sho u jyo da tte[01:29.87]
[01:29.87]chi te i no ta mi da tte[01:32.60]
[01:32.60]na ya mu ko to wa o na ji[01:37.71]
[01:37.71]i se i no hi me da tte[01:40.13]
[01:40.13]obake no sho u jyo u da tte[01:42.71]
[01:42.71]doki doki shi te mi n na ko i wo su ru[01:47.99]
[01:47.99]su ki na taibu da to ka[01:50.51]
[01:50.51]ri so u no ko ku ha ku wo[01:53.21]
[01:53.21]o mo i e ga i da to ki[01:55.66]
[01:55.66]da re no ka o ga u ka n de ki cha u no?![02:01.82]
[02:01.82]to tsu ze n chikara wa i te ki ta ri (fu shi gi da yo)[02:04.46]
[02:04.46]horori ya sa shi sa ga shi mi ta ri (na ze na no)[02:07.15]
[02:07.15]so re wa ze n bu da re no se i ka na[02:12.04]
[02:12.04]raibaru ni wa ma ke ta ku na i (so re na no ni)[02:14.74]
[02:14.74]da ke do aitsu ni wa ka te na i (na ze na no)[02:17.47]
[02:17.47]so re tte cho tto mo n da i a ru ke do[02:22.15]
[02:22.15]mo u te o ku re da ne[02:25.56]
[02:45.74]onna no ko no da i ji na mono (i ji wa ru de)[02:48.20]
[02:48.20]otoko no ko no da i ji na koto (mu ka tsu ku)[02:51.02]
[02:51.02]hi ku ni hi ke na i so re zo re no ji jyo u[02:55.95]
[02:55.95]ho ka ni na ni mo ka n ga e ra n na i (ma ssu gu gu de)[02:58.67]
[02:58.67]i sshu n da tte yo so mi de ki na i (ni bu i ne)[03:01.31]
[03:01.31]jyu u ji tsu ka n a fu re ru ho do ni[03:06.01]
[03:06.01]mi ta shi te a ge ru yo[03:07.02]
[03:07.02]jyo u ke n chi ra tsu ka se yo u su u ka ga tte[03:11.54]
[03:11.54]so n na ka n ji no tori hiki shi yo u yo[03:17.42]
[03:17.42]a no ne i ma no ko to ho n no ka zu percent shi ka[03:22.48]
[03:22.48]aitsu no ko ko ro ni i ba sho ga na i n da[03:27.19]
`,
  },
  {
    karaoke: true,
    label: "Karaoke Mode",
    value: `
[00:00.50] da [00:00.70]re [00:00.90]no [00:01.20]ko [00:01.35]to [00:01.50]wo [00:01.80]ka [00:01.90]n [00:02.15]ga [00:02.30]e [00:02.50]te [00:02.65]ru [00:02.80]no?
[00:03.10] haato [00:03.70]no [00:03.80]supeesu [00:04.60]so [00:04.80]u [00:05.00]da [00:05.20]tsu [00:05.50]se [00:05.60]n
[00:05.76] ze [00:06.20]n [00:06.45]ryo [00:06.65]u [00:06.90]te [00:07.20]ki [00:07.40]ni [00:08.20]i [00:08.40]sshi [00:08.80]n [00:09.20]i [00:09.40]tta [00:09.60]i [00:09.80]de
[00:10.56] yu u da n na ra na i na
[00:11.70] a no ne i ma no to ko ho n no ka zu percent shi ka
[00:16.73] aitsu no ko ko ro ni i ba sho ga na i n da
[00:21.38]

[00:21.51] se i fu ku no pokeeto
[00:24.05] ho n ne wo shi no ba se te
[00:26.71] so tto e ri wo ta da su
[00:31.71] so n na ka n ta n ni wa
[00:34.38] te no chi a ka se na i
[00:36.90] a ku ma de ma da yo u su mi no da n ka i
[00:41.81]

[00:42.01] da ke do ho n to u wa ne
[00:44.59] mi ya bu tte ho shi i no
[00:47.25] a wa i ki ta i ni mu ne to ki me ka shi te
[00:51.74] chira chira to mi te ru
[00:54.97]

[00:56.09] onna no ko no da i ji na mono (i ji wa ru de)
[00:58.73] otoko no ko no da i ji na koto (mu ka tsu ku)
[01:01.53] hi ku ni hi ke na i so re zo re no ji jyo u
[01:06.26] ho ka ni na ni mo ka n ga e ra n na i (ma ssu gu gu de)
[01:09.03] i sshu n da tte yo so mi de ki na i (ni bu i ne)
[01:11.68] jyu u ji tsu ka n a fu re ru ho do ni
[01:16.25] mi ta shi te a ge ru yo
[01:17.32] jyo u ke n chi ra tsu ka se yo u su u ka ga tte mi te ru
[01:22.50] o ta ga i win-win na tori hiki shi n yo u yo
[01:27.20]

[01:27.33] ma ho u sho u jyo da tte
[01:29.87] chi te i no ta mi da tte
[01:32.60] na ya mu ko to wa o na ji
[01:37.71] i se i no hi me da tte
[01:40.13] obake no sho u jyo u da tte
[01:42.71] doki doki shi te mi n na ko i wo su ru
[01:47.99] su ki na taibu da to ka
[01:50.51] ri so u no ko ku ha ku wo
[01:53.21] o mo i e ga i da to ki
[01:55.66] da re no ka o ga u ka n de ki cha u no?!
[02:01.82] to tsu ze n chikara wa i te ki ta ri (fu shi gi da yo)
[02:04.46] horori ya sa shi sa ga shi mi ta ri (na ze na no)
[02:07.15] so re wa ze n bu da re no se i ka na
[02:12.04] raibaru ni wa ma ke ta ku na i (so re na no ni)
[02:14.74] da ke do aitsu ni wa ka te na i (na ze na no)
[02:17.47] so re tte cho tto mo n da i a ru ke do
[02:22.15] mo u te o ku re da ne
[02:25.56]

[02:45.74] onna no ko no da i ji na mono (i ji wa ru de)
[02:48.20] otoko no ko no da i ji na koto (mu ka tsu ku)
[02:51.02] hi ku ni hi ke na i so re zo re no ji jyo u
[02:55.95] ho ka ni na ni mo ka n ga e ra n na i (ma ssu gu gu de)
[02:58.67] i sshu n da tte yo so mi de ki na i (ni bu i ne)
[03:01.31] jyu u ji tsu ka n a fu re ru ho do ni
[03:06.01] mi ta shi te a ge ru yo
[03:07.02] jyo u ke n chi ra tsu ka se yo u su u ka ga tte
[03:11.54] so n na ka n ji no tori hiki shi yo u yo
[03:17.42] a no ne i ma no ko to ho n no ka zu percent shi ka
[03:22.48] aitsu no ko ko ro ni i ba sho ga na i n da
[03:27.19]
`,
  },
];

export default function Demo(): ReactElement {
  const [audio, audioRef, setAudio] = useProxy<HTMLAudioElement | null>(null);

  const [current] = useRAFAudioTime(audio);
  const [content, setContent] = useState<string>(() => LyricsOptions[0].value);

  const handleChange = useCallback(
    (ct: TimePoint) => {
      if (!audioRef.current) {
        return;
      }

      audioRef.current.currentTime = ct / 1000;
    },
    [audioRef],
  );

  const karaoke = useMemo(
    () => LyricsOptions.find((o) => o.value === content)?.karaoke,
    [content],
  );

  return (
    <div className={styles.wrapper}>
      <audio className={styles.audio} ref={setAudio} controls>
        <source
          src="https://guoyunhe.me/wp-content/uploads/2015/03/hao-gan-win-win-wu-tiao-jian.ogg"
          type="audio/ogg"
        />
        <source
          src="https://guoyunhe.me/wp-content/uploads/2015/03/hao-gan-win-win-wu-tiao-jian.mp3"
          type="audio/mpeg"
        />
      </audio>
      <Lyrics
        current={current}
        karaoke={karaoke}
        content={content}
        onChange={handleChange}
      />
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
