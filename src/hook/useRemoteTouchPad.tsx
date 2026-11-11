import { useProxy } from "@allape/use-loading";
import { UseLoadingReturn } from "@allape/use-loading/lib/hook/useLoading";
import mqtt, { MqttClient } from "mqtt";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS,
  getDefaultRemoteTouchpadURL,
  getRemoteTouchpadTopics,
  normalizeRemoteTouchpadURL,
  parseRemoteTouchpadDataMessage,
  parseRemoteTouchpadSignal,
  parseRemoteTouchpadTimestamp,
  REMOTE_TOUCHPAD_DATA_CHANNEL,
  RemoteClock,
  RemoteTouchpadSignal,
  RemoteTouchpadTopics,
  createRemoteTouchpadSessionID,
  encodeRemoteTouchpadDataMessage,
} from "../core/remoteTouchpad";

const MQTT_CLOCK_INTERVAL = 5_000;
const RTC_CLOCK_INTERVAL = 3_000;
const OFFER_TIMEOUT = 15_000;
const INITIAL_RETRY_DELAY = 3_000;
const MAX_RETRY_DELAY = 15_000;
const PEER_DISCONNECT_TIMEOUT = 5_000;

interface PendingIceCandidate {
  session: string;
  candidate: RTCIceCandidateInit;
}

function clearTimer(timer: number): void {
  if (timer >= 0) {
    window.clearTimeout(timer);
  }
}

export interface UseRemoteTouchPadProps {
  execute: UseLoadingReturn["execute"];

  remoteTouchpadURL?: string;
  remoteTouchpadClientID?: string;
  /**
   * STUN / TURN configuration. Defaults to public STUN servers when omitted.
   */
  remoteTouchpadIceServers?: RTCIceServer[];

  onTouchDown?: (offset: number) => void;
  onTouchUp?: (offset: number) => void;
}

export interface UseRemoteTouchPadReturn {
  remoteTouchpadURL: string;
  setRemoteTouchpadURL: Dispatch<SetStateAction<string>>;

  remoteTouchpadClientID: string;
  setRemoteTouchpadClientID: Dispatch<SetStateAction<string>>;

  remoteTouchpadConnected: boolean;
  remoteTouchpadWebRTCConnected: boolean;

  connect: () => void;
}

export default function useRemoteTouchPad({
  remoteTouchpadURL: remoteTouchpadURLFromProps,
  remoteTouchpadClientID: remoteTouchpadClientIDFromProps,
  remoteTouchpadIceServers,
  onTouchDown,
  onTouchUp,
  execute,
}: UseRemoteTouchPadProps): UseRemoteTouchPadReturn {
  const mqttClientRef = useRef<MqttClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const topicsRef = useRef<RemoteTouchpadTopics | null>(null);
  const clockRef = useRef<RemoteClock>(new RemoteClock());
  const iceServersRef = useRef<RTCIceServer[]>(
    remoteTouchpadIceServers ?? DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS,
  );

  const callbacksRef = useRef<{
    onTouchDown?: (offset: number) => void;
    onTouchUp?: (offset: number) => void;
  }>({});

  const currentSessionRef = useRef<string>("");
  const senderSessionRef = useRef<string>("");
  const presenceOnlineRef = useRef<boolean>(false);
  const offerInFlightRef = useRef<boolean>(false);
  const pendingCandidatesRef = useRef<PendingIceCandidate[]>([]);

  const mqttClockTimerRef = useRef<number>(-1);
  const rtcClockTimerRef = useRef<number>(-1);
  const offerTimeoutTimerRef = useRef<number>(-1);
  const retryTimerRef = useRef<number>(-1);
  const peerDisconnectTimerRef = useRef<number>(-1);
  const retryDelayRef = useRef<number>(INITIAL_RETRY_DELAY);

  const sendOfferRef = useRef<() => void>(() => undefined);

  const [remoteTouchpadConnected, setRemoteTouchpadConnected] =
    useState<boolean>(false);
  const [remoteTouchpadWebRTCConnected, setRemoteTouchpadWebRTCConnected] =
    useState<boolean>(false);

  const [remoteTouchpadURL, remoteTouchpadURLRef, setRemoteTouchpadURL] =
    useProxy<string>(getDefaultRemoteTouchpadURL());
  const [
    remoteTouchpadClientID,
    remoteTouchpadClientIDRef,
    setRemoteTouchpadClientID,
  ] = useProxy<string>("1234");

  useEffect(() => {
    if (remoteTouchpadURLFromProps) {
      setRemoteTouchpadURL(remoteTouchpadURLFromProps);
    } else {
      setRemoteTouchpadURL(getDefaultRemoteTouchpadURL());
    }
  }, [remoteTouchpadURLFromProps, setRemoteTouchpadURL]);

  useEffect(() => {
    if (remoteTouchpadClientIDFromProps) {
      setRemoteTouchpadClientID(remoteTouchpadClientIDFromProps);
    } else {
      setRemoteTouchpadClientID("1234");
    }
  }, [remoteTouchpadClientIDFromProps, setRemoteTouchpadClientID]);

  useEffect(() => {
    iceServersRef.current =
      remoteTouchpadIceServers ?? DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS;
  }, [remoteTouchpadIceServers]);

  useEffect(() => {
    callbacksRef.current = { onTouchDown, onTouchUp };
  }, [onTouchDown, onTouchUp]);

  const closePeer = useCallback(() => {
    clearTimer(rtcClockTimerRef.current);
    rtcClockTimerRef.current = -1;
    clearTimer(offerTimeoutTimerRef.current);
    offerTimeoutTimerRef.current = -1;
    clearTimer(retryTimerRef.current);
    retryTimerRef.current = -1;
    clearTimer(peerDisconnectTimerRef.current);
    peerDisconnectTimerRef.current = -1;

    offerInFlightRef.current = false;
    pendingCandidatesRef.current = [];
    currentSessionRef.current = "";

    const dataChannel = dataChannelRef.current;
    dataChannelRef.current = null;
    if (dataChannel) {
      dataChannel.onopen = null;
      dataChannel.onclose = null;
      dataChannel.onerror = null;
      dataChannel.onmessage = null;
      dataChannel.close();
    }

    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }

    setRemoteTouchpadWebRTCConnected(false);
  }, []);

  const publishSignal = useCallback((signal: RemoteTouchpadSignal) => {
    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    if (!client?.connected || !topics) {
      return;
    }
    client.publish(topics.toTouchpad, JSON.stringify(signal), { qos: 1 });
  }, []);

  const sendMqttPing = useCallback(() => {
    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    if (!client?.connected || !topics) {
      return;
    }
    client.publish(
      topics.ping,
      JSON.stringify({ v: 1, type: "ping", t0: Date.now() }),
      { qos: 0 },
    );
  }, []);

  const startMqttClock = useCallback(() => {
    clearTimer(mqttClockTimerRef.current);
    sendMqttPing();
    mqttClockTimerRef.current = window.setInterval(
      sendMqttPing,
      MQTT_CLOCK_INTERVAL,
    );
  }, [sendMqttPing]);

  const sendRtcPing = useCallback(() => {
    const dataChannel = dataChannelRef.current;
    if (!dataChannel || dataChannel.readyState !== "open") {
      return;
    }
    dataChannel.send(
      encodeRemoteTouchpadDataMessage({
        v: 1,
        type: "ping",
        t0: Date.now(),
      }),
    );
  }, []);

  const scheduleRetry = useCallback((delay?: number) => {
    if (retryTimerRef.current >= 0) {
      return;
    }
    if (!presenceOnlineRef.current) {
      return;
    }
    if (dataChannelRef.current?.readyState === "open") {
      return;
    }

    const wait = delay ?? retryDelayRef.current;
    retryDelayRef.current = Math.min(
      Math.max(wait, INITIAL_RETRY_DELAY) * 1.5,
      MAX_RETRY_DELAY,
    );

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = -1;
      if (!presenceOnlineRef.current) {
        return;
      }
      if (dataChannelRef.current?.readyState === "open") {
        return;
      }
      sendOfferRef.current();
    }, wait);
  }, []);

  const setupDataChannel = useCallback(
    (dataChannel: RTCDataChannel) => {
      dataChannel.onopen = () => {
        retryDelayRef.current = INITIAL_RETRY_DELAY;
        offerInFlightRef.current = false;
        clearTimer(offerTimeoutTimerRef.current);
        offerTimeoutTimerRef.current = -1;
        clearTimer(retryTimerRef.current);
        retryTimerRef.current = -1;
        clearTimer(peerDisconnectTimerRef.current);
        peerDisconnectTimerRef.current = -1;

        setRemoteTouchpadWebRTCConnected(true);

        sendRtcPing();
        clearTimer(rtcClockTimerRef.current);
        rtcClockTimerRef.current = window.setInterval(
          sendRtcPing,
          RTC_CLOCK_INTERVAL,
        );
      };

      dataChannel.onclose = () => {
        if (dataChannelRef.current !== dataChannel) {
          return;
        }
        setRemoteTouchpadWebRTCConnected(false);
        closePeer();
        scheduleRetry(0);
      };

      dataChannel.onerror = (event) => {
        console.warn("Remote touchpad data channel error:", event);
      };

      dataChannel.onmessage = (event) => {
        const message = parseRemoteTouchpadDataMessage(event.data);
        if (!message) {
          return;
        }

        switch (message.type) {
          case "pong":
            clockRef.current.addSample(
              message.t0,
              message.t1,
              message.t2,
              Date.now(),
            );
            break;
          case "down":
            callbacksRef.current.onTouchDown?.(
              -clockRef.current.oneWayDelayOf(message.t),
            );
            break;
          case "up":
            callbacksRef.current.onTouchUp?.(
              -clockRef.current.oneWayDelayOf(message.t),
            );
            break;
          case "ping":
            break;
        }
      };
    },
    [closePeer, scheduleRetry, sendRtcPing],
  );

  const drainPendingCandidates = useCallback(
    async (pc: RTCPeerConnection, session: string) => {
      const pending = pendingCandidatesRef.current.filter(
        (item) => item.session === session,
      );
      pendingCandidatesRef.current = pendingCandidatesRef.current.filter(
        (item) => item.session !== session,
      );

      for (const item of pending) {
        try {
          await pc.addIceCandidate(item.candidate);
        } catch (error) {
          console.warn("Failed to add remote ICE candidate:", error);
        }
      }
    },
    [],
  );

  const sendOffer = useCallback(() => {
    if (offerInFlightRef.current) {
      return;
    }

    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    if (!client?.connected || !topics) {
      return;
    }
    if (!presenceOnlineRef.current) {
      return;
    }
    if (dataChannelRef.current?.readyState === "open") {
      return;
    }
    if (typeof RTCPeerConnection === "undefined") {
      console.warn(
        "WebRTC is not available in this browser, staying on MQTT fallback",
      );
      return;
    }

    closePeer();
    offerInFlightRef.current = true;

    const session = createRemoteTouchpadSessionID();
    currentSessionRef.current = session;

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    } catch (error) {
      console.error("Failed to create RTCPeerConnection:", error);
      closePeer();
      return;
    }
    pcRef.current = pc;

    const dataChannel = pc.createDataChannel(REMOTE_TOUCHPAD_DATA_CHANNEL, {
      ordered: true,
    });
    dataChannelRef.current = dataChannel;
    setupDataChannel(dataChannel);

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      publishSignal({
        v: 1,
        from: "consumer",
        type: "ice",
        session,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) {
        return;
      }

      switch (pc.connectionState) {
        case "connected":
          clearTimer(peerDisconnectTimerRef.current);
          peerDisconnectTimerRef.current = -1;
          break;
        case "disconnected":
          if (peerDisconnectTimerRef.current < 0) {
            peerDisconnectTimerRef.current = window.setTimeout(() => {
              peerDisconnectTimerRef.current = -1;
              if (pcRef.current !== pc) {
                return;
              }
              if (pc.connectionState === "connected") {
                return;
              }
              closePeer();
              scheduleRetry(0);
            }, PEER_DISCONNECT_TIMEOUT);
          }
          break;
        case "failed":
          closePeer();
          scheduleRetry(0);
          break;
      }
    };

    clearTimer(offerTimeoutTimerRef.current);
    offerTimeoutTimerRef.current = window.setTimeout(() => {
      if (pcRef.current !== pc) {
        return;
      }
      if (dataChannelRef.current?.readyState === "open") {
        return;
      }
      closePeer();
      scheduleRetry(0);
    }, OFFER_TIMEOUT);

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        const description = pc.localDescription;
        if (!description?.sdp) {
          throw new Error("Failed to create a local WebRTC offer");
        }
        if (pcRef.current !== pc) {
          return;
        }
        publishSignal({
          v: 1,
          from: "consumer",
          type: "offer",
          session,
          sdp: { type: "offer", sdp: description.sdp },
        });
      })
      .catch((error: unknown) => {
        console.error("Failed to create WebRTC offer:", error);
        if (pcRef.current !== pc) {
          return;
        }
        closePeer();
        scheduleRetry(0);
      });
  }, [closePeer, publishSignal, scheduleRetry, setupDataChannel]);

  useEffect(() => {
    sendOfferRef.current = sendOffer;
  }, [sendOffer]);

  const handleSignal = useCallback(
    (signal: RemoteTouchpadSignal) => {
      if (signal.from !== "touchpad") {
        return;
      }

      switch (signal.type) {
        case "presence": {
          if (!signal.online) {
            if (
              senderSessionRef.current &&
              senderSessionRef.current !== signal.session
            ) {
              return;
            }
            presenceOnlineRef.current = false;
            senderSessionRef.current = "";
            closePeer();
            return;
          }

          const isSameSender = senderSessionRef.current === signal.session;
          presenceOnlineRef.current = true;
          senderSessionRef.current = signal.session;

          if (isSameSender) {
            if (
              offerInFlightRef.current ||
              dataChannelRef.current?.readyState === "open"
            ) {
              return;
            }
          } else {
            // The touchpad page has been reopened, start from a fresh peer.
            clockRef.current.reset();
            closePeer();
          }

          sendOfferRef.current();
          break;
        }
        case "answer": {
          if (signal.session !== currentSessionRef.current) {
            return;
          }

          const pc = pcRef.current;
          if (!pc) {
            return;
          }

          pc.setRemoteDescription(signal.sdp)
            .then(() => drainPendingCandidates(pc, signal.session))
            .catch((error: unknown) => {
              console.error("Failed to apply WebRTC answer:", error);
              if (pcRef.current !== pc) {
                return;
              }
              closePeer();
              scheduleRetry(0);
            });
          break;
        }
        case "ice": {
          if (signal.session !== currentSessionRef.current) {
            return;
          }

          const pc = pcRef.current;
          if (!pc) {
            return;
          }

          if (pc.remoteDescription) {
            pc.addIceCandidate(signal.candidate).catch((error: unknown) => {
              console.warn("Failed to add remote ICE candidate:", error);
            });
          } else {
            pendingCandidatesRef.current.push({
              session: signal.session,
              candidate: signal.candidate,
            });
          }
          break;
        }
        case "bye": {
          if (signal.session && signal.session !== currentSessionRef.current) {
            return;
          }
          closePeer();
          break;
        }
      }
    },
    [closePeer, drainPendingCandidates, scheduleRetry],
  );

  const handleMqttMessage = useCallback(
    (topic: string, payload: Uint8Array) => {
      const topics = topicsRef.current;
      if (!topics) {
        return;
      }

      if (topic === topics.presence || topic === topics.toConsumer) {
        const signal = parseRemoteTouchpadSignal(payload);
        if (signal) {
          handleSignal(signal);
        }
        return;
      }

      if (topic === topics.pong) {
        const message = parseRemoteTouchpadDataMessage(payload);
        if (message?.type === "pong") {
          clockRef.current.addSample(
            message.t0,
            message.t1,
            message.t2,
            Date.now(),
          );
        }
        return;
      }

      if (topic === topics.keyDown || topic === topics.keyUp) {
        // The WebRTC data channel is the low latency path. MQTT events are
        // only consumed while the data channel is not available.
        if (dataChannelRef.current?.readyState === "open") {
          return;
        }

        const timestamp = parseRemoteTouchpadTimestamp(payload);
        if (timestamp === null) {
          return;
        }

        if (topic === topics.keyDown) {
          callbacksRef.current.onTouchDown?.(
            -clockRef.current.oneWayDelayOf(timestamp),
          );
        } else {
          callbacksRef.current.onTouchUp?.(
            -clockRef.current.oneWayDelayOf(timestamp),
          );
        }
      }
    },
    [handleSignal],
  );

  const handleDisconnect = useCallback(async () => {
    clearTimer(mqttClockTimerRef.current);
    mqttClockTimerRef.current = -1;

    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    const session = currentSessionRef.current;

    presenceOnlineRef.current = false;
    senderSessionRef.current = "";

    if (client?.connected && topics && session) {
      client.publish(
        topics.toTouchpad,
        JSON.stringify({
          v: 1,
          from: "consumer",
          type: "bye",
          session,
        }),
        { qos: 1 },
      );
    }

    closePeer();
    clockRef.current.reset();

    mqttClientRef.current = null;
    topicsRef.current = null;

    if (client) {
      try {
        await client.endAsync();
      } catch (error) {
        console.warn("Failed to close MQTT client:", error);
      }
    }

    setRemoteTouchpadConnected(false);
  }, [closePeer]);

  const handleConnect = useCallback(() => {
    execute(async () => {
      if (mqttClientRef.current) {
        await handleDisconnect();
        return;
      }

      if (!remoteTouchpadClientIDRef.current) {
        return;
      }

      const topics = getRemoteTouchpadTopics(remoteTouchpadClientIDRef.current);
      topicsRef.current = topics;
      clockRef.current.reset();
      presenceOnlineRef.current = false;
      senderSessionRef.current = "";
      retryDelayRef.current = INITIAL_RETRY_DELAY;

      const client = mqtt.connect(
        normalizeRemoteTouchpadURL(remoteTouchpadURLRef.current),
        {
          keepalive: 30,
          reconnectPeriod: 3_000,
          clean: true,
        },
      );
      mqttClientRef.current = client;

      client.on("connect", () => {
        if (mqttClientRef.current !== client) {
          return;
        }

        setRemoteTouchpadConnected(true);
        client.subscribe(
          [
            topics.presence,
            topics.toConsumer,
            topics.newClient,
            topics.keyDown,
            topics.keyUp,
            topics.pong,
          ],
          { qos: 0 },
          (error) => {
            if (mqttClientRef.current !== client) {
              return;
            }

            if (error) {
              console.error(
                "Failed to subscribe to remote touchpad topics:",
                error,
              );
            }

            // Ask an already online touchpad to (re)announce itself. The
            // retained presence message also covers the reverse start order.
            client.publish(
              topics.toTouchpad,
              JSON.stringify({ v: 1, from: "consumer", type: "hello" }),
              { qos: 1 },
            );
            startMqttClock();
          },
        );
      });

      client.on("message", (topic, payload) => {
        if (mqttClientRef.current !== client) {
          return;
        }
        handleMqttMessage(topic, payload);
      });

      client.on("offline", () => {
        if (mqttClientRef.current !== client) {
          return;
        }
        console.warn("Remote touchpad MQTT client is offline");
      });

      client.on("reconnect", () => {
        if (mqttClientRef.current !== client) {
          return;
        }
        console.warn("Remote touchpad MQTT client is reconnecting");
      });

      client.on("error", (error) => {
        if (mqttClientRef.current !== client) {
          return;
        }
        console.error("Remote touchpad MQTT error:", error);
      });
    }).then();
  }, [
    execute,
    handleDisconnect,
    handleMqttMessage,
    remoteTouchpadClientIDRef,
    remoteTouchpadURLRef,
    startMqttClock,
  ]);

  useEffect(() => {
    return () => {
      handleDisconnect().then();
    };
  }, [handleDisconnect]);

  return {
    remoteTouchpadURL,
    setRemoteTouchpadURL,
    remoteTouchpadClientID,
    setRemoteTouchpadClientID,
    remoteTouchpadConnected,
    remoteTouchpadWebRTCConnected,

    connect: handleConnect,
  };
}
