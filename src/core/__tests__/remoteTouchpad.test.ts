import { describe, expect, test } from "vitest";
import {
  normalizeRemoteTouchpadURL,
  parseRemoteTouchpadDataMessage,
  parseRemoteTouchpadIceServers,
  parseRemoteTouchpadSignal,
  parseRemoteTouchpadTimestamp,
  RemoteClock,
} from "../remoteTouchpad";

describe("RemoteClock", () => {
  test("estimates offset and one way delay", () => {
    const clock = new RemoteClock();
    const base = Date.now();

    clock.addSample(base, base + 5_020, base + 5_020, base + 40);

    expect(clock.rtt).toBe(40);
    expect(clock.toLocal(base + 6_000, base + 1_040)).toBe(base + 1_000);
    expect(clock.oneWayDelayOf(base + 6_000, base + 1_040)).toBe(40);
  });

  test("keeps the lowest RTT sample", () => {
    const clock = new RemoteClock();
    const base = Date.now();

    expect(clock.addSample(base, base + 100, base + 100, base + 400)).not.toBe(
      null,
    );
    expect(clock.addSample(base + 1, base + 6, base + 6, base + 9)).not.toBe(
      null,
    );

    expect(clock.rtt).toBe(8);
  });

  test("ignores invalid samples", () => {
    const clock = new RemoteClock();

    expect(clock.addSample(0, 1, 2, Number.NaN)).toBeNull();
    expect(clock.addSample(0, 1, 100, 10)).toBeNull();
    expect(clock.rtt).toBeNull();
    expect(clock.oneWayDelayOf(1_000)).toBe(0);
  });
});

describe("parseRemoteTouchpadSignal", () => {
  test("parses an offer", () => {
    const signal = parseRemoteTouchpadSignal(
      JSON.stringify({
        v: 1,
        from: "consumer",
        type: "offer",
        session: "abc",
        sdp: { type: "offer", sdp: "v=0" },
      }),
    );

    expect(signal?.type).toBe("offer");
    expect(signal?.from).toBe("consumer");
  });

  test("parses a retained presence", () => {
    const signal = parseRemoteTouchpadSignal(
      JSON.stringify({
        v: 1,
        from: "touchpad",
        type: "presence",
        session: "abc",
        online: true,
      }),
    );

    expect(signal?.type).toBe("presence");
    if (signal?.type === "presence") {
      expect(signal.online).toBe(true);
    }
  });

  test("rejects malformed signals", () => {
    expect(parseRemoteTouchpadSignal("not json")).toBeNull();
    expect(parseRemoteTouchpadSignal(JSON.stringify({ v: 2 }))).toBeNull();
    expect(
      parseRemoteTouchpadSignal(
        JSON.stringify({
          v: 1,
          from: "touchpad",
          type: "answer",
          session: "abc",
          sdp: { type: "answer" },
        }),
      ),
    ).toBeNull();
  });
});

describe("parseRemoteTouchpadDataMessage", () => {
  test("parses touch events", () => {
    const message = parseRemoteTouchpadDataMessage(
      new TextEncoder().encode(JSON.stringify({ v: 1, type: "down", t: 1234 })),
    );

    expect(message).toEqual({ v: 1, type: "down", t: 1234 });
  });

  test("parses clock messages", () => {
    expect(
      parseRemoteTouchpadDataMessage(
        JSON.stringify({ v: 1, type: "pong", t0: 1, t1: 2, t2: 3 }),
      ),
    ).toEqual({ v: 1, type: "pong", t0: 1, t1: 2, t2: 3 });
  });

  test("rejects unknown data", () => {
    expect(parseRemoteTouchpadDataMessage("nope")).toBeNull();
    expect(
      parseRemoteTouchpadDataMessage(JSON.stringify({ v: 1, type: "nope" })),
    ).toBeNull();
  });
});

describe("parseRemoteTouchpadTimestamp", () => {
  test("supports legacy plain timestamps", () => {
    expect(parseRemoteTouchpadTimestamp("1700000000000")).toBe(1700000000000);
  });

  test("supports JSON payloads", () => {
    expect(parseRemoteTouchpadTimestamp(JSON.stringify({ t: 42 }))).toBe(42);
    expect(parseRemoteTouchpadTimestamp(JSON.stringify({ t0: 43 }))).toBe(43);
    expect(parseRemoteTouchpadTimestamp("hello")).toBeNull();
  });
});

describe("ICE servers", () => {
  test("parses STUN and TURN entries", () => {
    expect(
      parseRemoteTouchpadIceServers(
        JSON.stringify([
          "stun:stun.example.com:3478",
          {
            urls: ["turn:turn.example.com:3478"],
            username: "user",
            credential: "pass",
          },
        ]),
      ),
    ).toEqual([
      { urls: "stun:stun.example.com:3478" },
      {
        urls: ["turn:turn.example.com:3478"],
        username: "user",
        credential: "pass",
      },
    ]);
  });

  test("keeps an explicit empty list and rejects invalid lists", () => {
    expect(parseRemoteTouchpadIceServers("[]")).toEqual([]);
    expect(parseRemoteTouchpadIceServers("{}")).toBeUndefined();
    expect(parseRemoteTouchpadIceServers("nope")).toBeUndefined();
    expect(parseRemoteTouchpadIceServers(undefined)).toBeUndefined();
  });
});

describe("normalizeRemoteTouchpadURL", () => {
  test("maps mqtt schemes to browser WebSocket schemes", () => {
    expect(normalizeRemoteTouchpadURL("mqtt://example.com:8080")).toBe(
      "ws://example.com:8080",
    );
    expect(normalizeRemoteTouchpadURL("mqtts://example.com:8080")).toBe(
      "wss://example.com:8080",
    );
    expect(normalizeRemoteTouchpadURL("ws://example.com:8080")).toBe(
      "ws://example.com:8080",
    );
  });
});
