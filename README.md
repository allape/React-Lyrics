# React Lyrics

React Component for Making and Display Lyrics of A Song

## [Playground](https://allape.github.io/React-Lyrics/): https://allape.github.io/React-Lyrics/

## TODO

- [x] Basic Mode
- [x] Karaoke Mode
- [x] Lyrics Creator

### Practical Project

- Homesong: https://github.com/allape/homesong
  - Song Management for Home NAS

### Installation

```shell
npm install github:allape/React-Lyrics
```

### Usage

See [SimplePlayer](src/view/SimplePlayer/index.tsx) for complete demo.

```tsx
import { Lyrics, TimePoint, useRAFAudioTime } from "@allape/lyrics";
import { ReactElement, useCallback } from "react";

export function Display({ text, karaoke }: Props): ReactElement {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [current] = useRAFAudioTime(audio);

  const handleChange = useCallback(
    (tp: TimePoint) => {
      if (!audio) {
        return;
      }
      audio.currentTime = tp / 1000;
    },
    [audio],
  );

  return (
    <>
      <auido ref={setAudio} src={url} controls />
      <Lyrics
        current={current}
        content={text}
        karaoke={karaoke}
        onChange={handleChange}
      />
    </>
  );
}
```

### Dev

```shell
npm install
npm run dev
```

### Remote Touchpad (WebRTC)

The remote touchpad uses MQTT as a signalling and presence channel. The actual
touch events are sent over a WebRTC data channel, which avoids the round trip
through the MQTT broker. If a peer connection cannot be established, touch
events automatically fall back to the legacy MQTT topics so the touchpad remains
usable while WebRTC is negotiating.

1. Start an MQTT broker with WebSocket support:

   ```shell
   docker run -p 8080:8080 -d --name mqtt --restart=unless-stopped eclipse-mosquitto
   docker exec -it mqtt ash
   cat << EOF > /mosquitto/config/mosquitto.conf
   listener 1883
   allow_anonymous true

   listener 8080
   protocol websockets
   allow_anonymous true
   connection_messages true
   EOF
   docker restart mqtt
   ```

2. Open the touchpad on the phone, for example:

   ```text
   http://192.168.1.20:5173/?remoteTouchpadURL=ws://192.168.1.10:8080&remoteTouchpadClientID=1234#remote-touchpad
   ```

3. Open the Lyrics Creator on the computer with the same parameters, click
   `Connect`, then connect the touchpad. The status shows `WebRTC Connected`
   once the data channel is live.

> [!NOTE]
> If the app is served over HTTPS (for example GitHub Pages), the MQTT URL must
> use `wss://`; browsers block `ws://` as mixed content. Wake Lock also requires
> a secure context.

Supported query parameters (they must match on both pages):

| Parameter                  | Description                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `remoteTouchpadURL`        | MQTT WebSocket URL. `mqtt://` / `mqtts://` are normalized to `ws://` / `wss://`. Defaults to `ws://<current-host>:8080`.                           |
| `remoteTouchpadClientID`   | Shared channel ID. Defaults to `1234`.                                                                                                             |
| `remoteTouchpadIceServers` | URL-encoded JSON array of `RTCIceServer` objects. Defaults to public STUN servers. Add a TURN server when the two devices are not on the same LAN. |

For a TURN server, pass the same URL-encoded JSON to both pages, for example:

```json
[
  {
    "urls": "turn:turn.example.com:3478",
    "username": "user",
    "credential": "pass"
  }
]
```

The MQTT topics used are `<id>:presence`, `<id>:signal:to-touchpad`,
`<id>:signal:to-consumer`, and the legacy `<id>:keydown` / `<id>:keyup` /
`<id>:ping` / `<id>:pong` fallback topics.

### File Format

See [唐朝乐队 - 国际歌 / Tang Dynasty - L'Internationale](example/%E5%94%90%E6%9C%9D%E4%B9%90%E9%98%9F%20-%20%E5%9B%BD%E9%99%85%E6%AD%8C.lrcp)
for example.

# Credits

- [favicon.png](public/favicon.png): https://www.irasutoya.com/2013/05/blog-post_7121.html
  - Terms(ご利用規定): https://www.irasutoya.com/p/terms.html
- [英特纳雄耐尔.ogg](public/%E8%8B%B1%E7%89%B9%E7%BA%B3%E9%9B%84%E8%80%90%E5%B0%94.ogg): https://zh.wikipedia.org/wiki/File:Internationale.ogg
