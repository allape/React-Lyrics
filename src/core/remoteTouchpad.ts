/**
 * Shared protocol helpers for the remote touchpad.
 *
 * MQTT is used as the signalling / presence channel. Once the WebRTC peer
 * connection is established, touch events travel over the data channel and
 * MQTT is only used as a fallback.
 */

export const REMOTE_TOUCHPAD_DATA_CHANNEL = "touchpad";

/**
 * Public STUN servers are enough for most home / LAN setups. They are not
 * enough for symmetric NATs, pass a TURN server via
 * `?remoteTouchpadIceServers=...` in that case.
 */
export const DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"],
  },
];

export interface RemoteTouchpadTopics {
  base: string;
  /** Retained presence announced by the touchpad. */
  presence: string;
  /** Signals sent by the consumer to the touchpad. */
  toTouchpad: string;
  /** Signals sent by the touchpad to the consumer. */
  toConsumer: string;
  keyDown: string;
  keyUp: string;
  ping: string;
  pong: string;
  /** Legacy presence topic kept for older touchpad pages. */
  newClient: string;
}

export function getRemoteTouchpadTopics(
  clientID: string,
): RemoteTouchpadTopics {
  const base = clientID.trim();
  return {
    base,
    presence: `${base}:presence`,
    toTouchpad: `${base}:signal:to-touchpad`,
    toConsumer: `${base}:signal:to-consumer`,
    keyDown: `${base}:keydown`,
    keyUp: `${base}:keyup`,
    ping: `${base}:ping`,
    pong: `${base}:pong`,
    newClient: `${base}:new-client`,
  };
}

export function getDefaultRemoteTouchpadURL(): string {
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:8080";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8080`;
}

/**
 * mqtt.js only supports WebSocket transports in the browser. Older links may
 * still use the `mqtt://` / `mqtts://` scheme.
 */
export function normalizeRemoteTouchpadURL(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("mqtt://")) {
    return `ws://${trimmed.substring("mqtt://".length)}`;
  }
  if (trimmed.startsWith("mqtts://")) {
    return `wss://${trimmed.substring("mqtts://".length)}`;
  }
  return trimmed;
}

export function createRemoteTouchpadSessionID(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

export type RemoteTouchpadSignal =
  | { v: 1; from: "consumer"; type: "hello" }
  | {
      v: 1;
      from: "consumer";
      type: "offer";
      session: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      v: 1;
      from: "consumer";
      type: "ice";
      session: string;
      candidate: RTCIceCandidateInit;
    }
  | { v: 1; from: "consumer"; type: "bye"; session: string }
  | {
      v: 1;
      from: "touchpad";
      type: "presence";
      session: string;
      online: boolean;
    }
  | {
      v: 1;
      from: "touchpad";
      type: "answer";
      session: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      v: 1;
      from: "touchpad";
      type: "ice";
      session: string;
      candidate: RTCIceCandidateInit;
    }
  | { v: 1; from: "touchpad"; type: "bye"; session: string };

export type RemoteTouchpadDataMessage =
  | { v: 1; type: "down"; t: number }
  | { v: 1; type: "up"; t: number }
  | { v: 1; type: "ping"; t0: number }
  | { v: 1; type: "pong"; t0: number; t1: number; t2: number };

export function encodeRemoteTouchpadDataMessage(
  message: RemoteTouchpadDataMessage,
): string {
  return JSON.stringify(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function payloadToText(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload instanceof Uint8Array) {
    return new TextDecoder().decode(payload);
  }
  if (payload instanceof ArrayBuffer) {
    return new TextDecoder().decode(payload);
  }
  return null;
}

function isSessionDescription(
  value: unknown,
): value is RTCSessionDescriptionInit {
  return (
    isObject(value) &&
    typeof value.type === "string" &&
    typeof value.sdp === "string"
  );
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  return isObject(value) && typeof value.candidate === "string";
}

export function parseRemoteTouchpadSignal(
  payload: unknown,
): RemoteTouchpadSignal | null {
  const text = payloadToText(payload);
  if (!text) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isObject(value) || value.v !== 1 || typeof value.type !== "string") {
    return null;
  }

  const from = value.from;
  if (from !== "consumer" && from !== "touchpad") {
    return null;
  }

  switch (value.type) {
    case "hello":
      return from === "consumer" ? (value as RemoteTouchpadSignal) : null;
    case "presence":
      return from === "touchpad" &&
        typeof value.session === "string" &&
        typeof value.online === "boolean"
        ? (value as RemoteTouchpadSignal)
        : null;
    case "offer":
      return from === "consumer" &&
        typeof value.session === "string" &&
        isSessionDescription(value.sdp)
        ? (value as RemoteTouchpadSignal)
        : null;
    case "answer":
      return from === "touchpad" &&
        typeof value.session === "string" &&
        isSessionDescription(value.sdp)
        ? (value as RemoteTouchpadSignal)
        : null;
    case "ice":
      return typeof value.session === "string" &&
        isIceCandidate(value.candidate)
        ? (value as RemoteTouchpadSignal)
        : null;
    case "bye":
      return typeof value.session === "string"
        ? (value as RemoteTouchpadSignal)
        : null;
    default:
      return null;
  }
}

export function parseRemoteTouchpadDataMessage(
  payload: unknown,
): RemoteTouchpadDataMessage | null {
  const text = payloadToText(payload);
  if (!text) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isObject(value) || value.v !== 1 || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "down":
    case "up":
      return typeof value.t === "number" && Number.isFinite(value.t)
        ? (value as RemoteTouchpadDataMessage)
        : null;
    case "ping":
      return typeof value.t0 === "number" && Number.isFinite(value.t0)
        ? (value as RemoteTouchpadDataMessage)
        : null;
    case "pong":
      return typeof value.t0 === "number" &&
        Number.isFinite(value.t0) &&
        typeof value.t1 === "number" &&
        Number.isFinite(value.t1) &&
        typeof value.t2 === "number" &&
        Number.isFinite(value.t2)
        ? (value as RemoteTouchpadDataMessage)
        : null;
    default:
      return null;
  }
}

/**
 * Touch events sent through MQTT are plain timestamps (legacy compatible),
 * newer senders may use a JSON object as well.
 */
export function parseRemoteTouchpadTimestamp(payload: unknown): number | null {
  const text = payloadToText(payload);
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const timestamp = Number(trimmed);
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }

  try {
    const value: unknown = JSON.parse(trimmed);
    if (!isObject(value)) {
      return null;
    }
    for (const key of ["t", "t0", "timestamp"]) {
      const candidate = value[key];
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export interface RemoteClockSample {
  offset: number;
  rtt: number;
  at: number;
}

const MAX_CLOCK_SAMPLES = 8;
const MAX_CLOCK_SAMPLE_AGE = 60_000;
const MAX_ONE_WAY_DELAY = 5_000;

/**
 * NTP-like clock synchronisation over an existing transport.
 *
 * `offset` is `remoteTime - localTime`. The sample with the lowest RTT is used
 * so that a single slow MQTT round trip cannot poison the estimate.
 */
export class RemoteClock {
  private samples: RemoteClockSample[] = [];

  addSample(
    t0: number,
    t1: number,
    t2: number,
    t3: number,
  ): RemoteClockSample | null {
    if (![t0, t1, t2, t3].every((value) => Number.isFinite(value))) {
      return null;
    }

    const rtt = t3 - t0 - (t2 - t1);
    if (!Number.isFinite(rtt) || rtt < 0) {
      return null;
    }

    const sample: RemoteClockSample = {
      offset: (t1 - t0 + (t2 - t3)) / 2,
      rtt,
      at: Date.now(),
    };

    this.samples.push(sample);
    if (this.samples.length > MAX_CLOCK_SAMPLES) {
      this.samples.shift();
    }

    return sample;
  }

  private best(now = Date.now()): RemoteClockSample | null {
    this.samples = this.samples.filter(
      (sample) => now - sample.at <= MAX_CLOCK_SAMPLE_AGE,
    );

    let best: RemoteClockSample | null = null;
    for (const sample of this.samples) {
      if (!best || sample.rtt < best.rtt) {
        best = sample;
      }
    }
    return best;
  }

  get rtt(): number | null {
    return this.best()?.rtt ?? null;
  }

  toLocal(remoteTime: number, now = Date.now()): number | null {
    const sample = this.best(now);
    if (!sample) {
      return null;
    }
    return remoteTime - sample.offset;
  }

  /**
   * Estimated time between a remote event and receiving it locally. The value
   * is clamped to a sane range as an inaccurate clock sample can produce
   * negative values.
   */
  oneWayDelayOf(remoteTime: number, now = Date.now()): number {
    const sample = this.best(now);
    if (!sample) {
      return 0;
    }

    const delay = now - (remoteTime - sample.offset);
    if (!Number.isFinite(delay)) {
      return Math.min(Math.max(sample.rtt / 2, 0), MAX_ONE_WAY_DELAY);
    }
    return Math.min(Math.max(delay, 0), MAX_ONE_WAY_DELAY);
  }

  reset(): void {
    this.samples = [];
  }
}

/**
 * Parses `?remoteTouchpadIceServers=<JSON>`.
 *
 * Examples:
 * - `[{"urls":"stun:stun.example.com:3478"}]`
 * - `[{"urls":"turn:turn.example.com:3478","username":"user","credential":"pass"}]`
 * - `[]` to disable STUN entirely (LAN-only host candidates).
 */
export function parseRemoteTouchpadIceServers(
  value?: string | null,
): RTCIceServer[] | undefined {
  if (!value) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const servers: RTCIceServer[] = [];
  for (const item of parsed) {
    if (typeof item === "string") {
      const url = item.trim();
      if (url) {
        servers.push({ urls: url });
      }
      continue;
    }

    if (!isObject(item)) {
      continue;
    }

    const urls = (
      typeof item.urls === "string"
        ? [item.urls]
        : Array.isArray(item.urls)
          ? item.urls
          : []
    ).filter((url): url is string => typeof url === "string" && !!url.trim());

    if (!urls.length) {
      continue;
    }

    const server: RTCIceServer = { urls };
    if (typeof item.username === "string") {
      server.username = item.username;
    }
    if (typeof item.credential === "string") {
      server.credential = item.credential;
    }
    servers.push(server);
  }

  return servers;
}
