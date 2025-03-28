# React Lyrics

React Component for Making and Display Lyrics of A Song

## [Playground](https://allape.github.io/React-Lyrics/): https://allape.github.io/React-Lyrics/

## TODO

- [x] Basic Mode
- [x] Karaoke Mode
- [x] Lyrics Editor
- [ ] Apple Music Style (Almost)

### Installation

```shell
npm install github:allape/React-Lyrics
```

### Usage

See [SimplePlayer](src/view/SimplePlayer/index.tsx) for complete demo.

```tsx
import { Lyrics, TimePoint, useRAFAudioTime } from '@allape/lyrics';
import { ReactElement, useCallback } from 'react';

export function Display({ text, karaoke }: Props): ReactElement {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [current] = useRAFAudioTime(audio);

  const handleChange = useCallback((tp: TimePoint) => {
    if (!audio) {
      return;
    }
    audio.currentTime = tp / 1000;
  }, [audio]);

  return <>
    <auido ref={setAudio} src={url} controls/>
    <Lyrics
            current={current}
            content={text}
            karaoke={karaoke}
            onChange={handleChange}
    />
  </>;
}
```

### Dev

```shell
npm install
npm run dev
```

### File Format

See [唐朝乐队 - 国际歌 / Tang Dynasty - L'Internationale](example/%E5%94%90%E6%9C%9D%E4%B9%90%E9%98%9F%20-%20%E5%9B%BD%E9%99%85%E6%AD%8C.lrcp)
for example.

# Credits

- [favicon.png](public/favicon.png): https://www.irasutoya.com/2013/05/blog-post_7121.html
    - Terms(ご利用規定): https://www.irasutoya.com/p/terms.html
- [英特纳雄耐尔.ogg](public/%E8%8B%B1%E7%89%B9%E7%BA%B3%E9%9B%84%E8%80%90%E5%B0%94.ogg): https://zh.wikipedia.org/wiki/File:Internationale.ogg
