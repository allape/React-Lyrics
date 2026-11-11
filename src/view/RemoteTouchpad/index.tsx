/**

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

 MQTT is only used for presence and WebRTC signalling. Touch events are sent
 over the WebRTC data channel and fall back to MQTT while the peer is not
 connected. For networks with symmetric NATs, pass a TURN server through the
 `remoteTouchpadIceServers` query parameter (JSON, URL encoded).

 */

import { useLoading, useProxy } from "@allape/use-loading";
import cls from "classnames";
import mqtt, { MqttClient } from "mqtt";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import TouchPad from "../../component/TouchPad";
import {
  DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS,
  getDefaultRemoteTouchpadURL,
  getRemoteTouchpadTopics,
  normalizeRemoteTouchpadURL,
  parseRemoteTouchpadDataMessage,
  parseRemoteTouchpadSignal,
  parseRemoteTouchpadTimestamp,
  RemoteTouchpadSignal,
  RemoteTouchpadTopics,
  createRemoteTouchpadSessionID,
  encodeRemoteTouchpadDataMessage,
} from "../../core/remoteTouchpad";
import useParamsFromSearchParams from "../../hook/useParamsFromSearchParams.ts";
import styles from "./style.module.scss";

function now(): string {
  return `${Date.now()}`;
}

const PEER_DISCONNECT_TIMEOUT = 5_000;

interface PendingIceCandidate {
  session: string;
  candidate: RTCIceCandidateInit;
}

export default function RemoteTouchpad(): ReactElement {
  const {
    remoteTouchpadURL: remoteTouchpadURLFromProps,
    remoteTouchpadClientID: remoteTouchpadClientIDFromProps,
    remoteTouchpadIceServers,
  } = useParamsFromSearchParams();

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const mqttClientRef = useRef<MqttClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const topicsRef = useRef<RemoteTouchpadTopics | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(
    remoteTouchpadIceServers ?? DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS,
  );

  const senderSessionRef = useRef<string>(createRemoteTouchpadSessionID());
  const remoteSessionRef = useRef<string>("");
  const pendingCandidatesRef = useRef<PendingIceCandidate[]>([]);
  const peerDisconnectTimerRef = useRef<number>(-1);

  const { loading, execute } = useLoading();

  const [connected, setConnected] = useState<boolean>(false);

  const [url, urlRef, setUrl] = useProxy<string>(getDefaultRemoteTouchpadURL());
  const [clientId, clientIdRef, setClientId] = useProxy<string>("1234");

  const [message, setMessage] = useState<string>("Standby");
  const [okay, setOkay] = useState<boolean>(true);

  useEffect(() => {
    if (remoteTouchpadURLFromProps) {
      setUrl(remoteTouchpadURLFromProps);
    } else {
      setUrl(getDefaultRemoteTouchpadURL());
    }
  }, [remoteTouchpadURLFromProps, setUrl]);

  useEffect(() => {
    if (remoteTouchpadClientIDFromProps) {
      setClientId(remoteTouchpadClientIDFromProps);
    } else {
       setClientId("1234");
    }
  }, [remoteTouchpadClientIDFromProps, setClientId]);

  useEffect(() => {
    iceServersRef.current =
      remoteTouchpadIceServers ?? DEFAULT_REMOTE_TOUCHPAD_ICE_SERVERS;
  }, [remoteTouchpadIceServers]);

  const refreshStatus = useCallback(() => {
    const client = mqttClientRef.current;
    if (!client) {
      setMessage("Standby");
      setOkay(true);
      return;
    }
    if (!client.connected) {
      setMessage("Connecting");
      setOkay(true);
      return;
    }
    if (dataChannelRef.current?.readyState === "open") {
      setMessage("WebRTC Connected");
      setOkay(true);
      return;
    }
    setMessage("Signaling Connected · MQTT Fallback");
    setOkay(true);
  }, []);

  const publishSignal = useCallback((signal: RemoteTouchpadSignal) => {
    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    if (!client?.connected || !topics) {
      return;
    }
    client.publish(topics.toConsumer, JSON.stringify(signal), { qos: 1 });
  }, []);

  const publishPresence = useCallback((online: boolean) => {
    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    if (!client?.connected || !topics) {
      return;
    }
    client.publish(
      topics.presence,
      JSON.stringify({
        v: 1,
        from: "touchpad",
        type: "presence",
        session: senderSessionRef.current,
        online,
      }),
      { qos: 1, retain: true },
    );
  }, []);

  const closePeer = useCallback(() => {
    pendingCandidatesRef.current = [];
    remoteSessionRef.current = "";
    if (peerDisconnectTimerRef.current >= 0) {
      window.clearTimeout(peerDisconnectTimerRef.current);
      peerDisconnectTimerRef.current = -1;
    }

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
      pc.ondatachannel = null;
      pc.close();
    }

    refreshStatus();
  }, [refreshStatus]);

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

  const attachDataChannel = useCallback(
    (dataChannel: RTCDataChannel) => {
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        if (peerDisconnectTimerRef.current >= 0) {
          window.clearTimeout(peerDisconnectTimerRef.current);
          peerDisconnectTimerRef.current = -1;
        }
        refreshStatus();
      };

      dataChannel.onclose = () => {
        if (dataChannelRef.current !== dataChannel) {
          return;
        }
        dataChannelRef.current = null;
        closePeer();
      };

      dataChannel.onerror = (event) => {
        console.warn("Remote touchpad data channel error:", event);
      };

      dataChannel.onmessage = (event) => {
        const message = parseRemoteTouchpadDataMessage(event.data);
        if (!message || message.type !== "ping") {
          return;
        }

        const t1 = Date.now();
        try {
          dataChannel.send(
            encodeRemoteTouchpadDataMessage({
              v: 1,
              type: "pong",
              t0: message.t0,
              t1,
              t2: Date.now(),
            }),
          );
        } catch (error) {
          console.warn("Failed to send WebRTC clock response:", error);
        }
      };
    },
    [closePeer, refreshStatus],
  );

  const handleSignal = useCallback(
    (signal: RemoteTouchpadSignal) => {
      if (signal.from !== "consumer") {
        return;
      }

      switch (signal.type) {
        case "hello":
          publishPresence(true);
          break;
        case "offer": {
          if (typeof RTCPeerConnection === "undefined") {
            console.warn(
              "WebRTC is not available in this browser, staying on MQTT fallback",
            );
            break;
          }

          closePeer();

          let pc: RTCPeerConnection;
          try {
            pc = new RTCPeerConnection({
              iceServers: iceServersRef.current,
            });
          } catch (error) {
            console.error("Failed to create RTCPeerConnection:", error);
            break;
          }
          pcRef.current = pc;
          remoteSessionRef.current = signal.session;

          pc.ondatachannel = (event) => {
            attachDataChannel(event.channel);
          };

          pc.onicecandidate = (event) => {
            if (!event.candidate) {
              return;
            }
            publishSignal({
              v: 1,
              from: "touchpad",
              type: "ice",
              session: signal.session,
              candidate: event.candidate.toJSON(),
            });
          };

          pc.onconnectionstatechange = () => {
            if (pcRef.current !== pc) {
              return;
            }

            switch (pc.connectionState) {
              case "connected":
                if (peerDisconnectTimerRef.current >= 0) {
                  window.clearTimeout(peerDisconnectTimerRef.current);
                  peerDisconnectTimerRef.current = -1;
                }
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
                  }, PEER_DISCONNECT_TIMEOUT);
                }
                break;
              case "failed":
                closePeer();
                break;
            }
          };

          pc.setRemoteDescription(signal.sdp)
            .then(() => drainPendingCandidates(pc, signal.session))
            .then(() => pc.createAnswer())
            .then((answer) => pc.setLocalDescription(answer))
            .then(() => {
              const description = pc.localDescription;
              if (!description?.sdp) {
                throw new Error("Failed to create a local WebRTC answer");
              }
              if (pcRef.current !== pc) {
                return;
              }
              publishSignal({
                v: 1,
                from: "touchpad",
                type: "answer",
                session: signal.session,
                sdp: { type: "answer", sdp: description.sdp },
              });
              refreshStatus();
            })
            .catch((error: unknown) => {
              console.error("Failed to answer WebRTC offer:", error);
              if (pcRef.current !== pc) {
                return;
              }
              closePeer();
            });
          break;
        }
        case "ice": {
          if (signal.session !== remoteSessionRef.current) {
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
          if (signal.session && signal.session !== remoteSessionRef.current) {
            return;
          }
          closePeer();
          break;
        }
      }
    },
    [
      attachDataChannel,
      closePeer,
      drainPendingCandidates,
      publishPresence,
      publishSignal,
      refreshStatus,
    ],
  );

  const handleTouchUp = useCallback((): void => {
    const dataChannel = dataChannelRef.current;
    if (dataChannel?.readyState === "open") {
      try {
        dataChannel.send(
          encodeRemoteTouchpadDataMessage({
            v: 1,
            type: "up",
            t: Date.now(),
          }),
        );
        return;
      } catch (error) {
        console.warn("Failed to send WebRTC touch up:", error);
      }
    }

    // MQTT fallback keeps the touchpad usable while WebRTC is negotiating or
    // blocked by the network.
    mqttClientRef.current?.publish(
      topicsRef.current?.keyUp ?? `${clientIdRef.current}:keyup`,
      now(),
    );
  }, [clientIdRef]);

  const handleTouchDown = useCallback((): void => {
    const dataChannel = dataChannelRef.current;
    if (dataChannel?.readyState === "open") {
      try {
        dataChannel.send(
          encodeRemoteTouchpadDataMessage({
            v: 1,
            type: "down",
            t: Date.now(),
          }),
        );
        return;
      } catch (error) {
        console.warn("Failed to send WebRTC touch down:", error);
      }
    }

    mqttClientRef.current?.publish(
      topicsRef.current?.keyDown ?? `${clientIdRef.current}:keydown`,
      now(),
    );
  }, [clientIdRef]);

  const requestWakeLock = useCallback(async () => {
    if (!navigator.wakeLock) {
      return;
    }

    try {
      await wakeLockRef.current?.release();
    } catch (error) {
      console.warn("Failed to release old wake lock:", error);
    }
    wakeLockRef.current = null;

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (error) {
      console.warn("Failed to acquire wake lock:", error);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch (error) {
      console.warn("Failed to release wake lock:", error);
    }
    wakeLockRef.current = null;
  }, []);

  const handleDisconnect = useCallback(async () => {
    const client = mqttClientRef.current;
    const topics = topicsRef.current;
    const session = remoteSessionRef.current;

    if (client?.connected && topics) {
      if (session) {
        publishSignal({
          v: 1,
          from: "touchpad",
          type: "bye",
          session,
        });
      }
      publishPresence(false);
    }

    closePeer();

    mqttClientRef.current = null;
    topicsRef.current = null;

    if (client) {
      try {
        await client.endAsync();
      } catch (error) {
        console.warn("Failed to close MQTT client:", error);
      }
    }

    await releaseWakeLock();

    setConnected(false);
    setMessage("Standby");
    setOkay(true);
  }, [closePeer, publishPresence, publishSignal, releaseWakeLock]);

  const handleButtonClick = useCallback(() => {
    execute(async () => {
      if (mqttClientRef.current) {
        await handleDisconnect();
        return;
      }

      setMessage("Connecting");
      setOkay(true);

      const topics = getRemoteTouchpadTopics(clientIdRef.current);
      topicsRef.current = topics;

      // The broker publishes this Last Will if the page/network dies without
      // a clean disconnect, so consumers stop waiting for a dead peer.
      const offlinePresence = JSON.stringify({
        v: 1,
        from: "touchpad",
        type: "presence",
        session: senderSessionRef.current,
        online: false,
      });

      const client = mqtt.connect(normalizeRemoteTouchpadURL(urlRef.current), {
        keepalive: 30,
        reconnectPeriod: 3_000,
        clean: true,
        will: {
          topic: topics.presence,
          payload: offlinePresence,
          qos: 1,
          retain: true,
        },
      });
      mqttClientRef.current = client;

      client.on("connect", () => {
        if (mqttClientRef.current !== client) {
          return;
        }

        setConnected(true);
        client.subscribe(
          [topics.toTouchpad, topics.ping],
          { qos: 0 },
          (error) => {
            if (mqttClientRef.current !== client) {
              return;
            }

            if (error) {
              console.error(
                "Failed to subscribe to remote touchpad requests:",
                error,
              );
            }
            publishPresence(true);
            // Legacy announcement, still picked up by older consumer pages.
            client.publish(topics.newClient, now());
            refreshStatus();
          },
        );
      });

      client.on("message", (topic, payload) => {
        if (mqttClientRef.current !== client) {
          return;
        }

        if (topic === topics.ping) {
          const t0 = parseRemoteTouchpadTimestamp(payload) ?? Date.now();
          const t1 = Date.now();
          client.publish(
            topics.pong,
            JSON.stringify({ v: 1, type: "pong", t0, t1, t2: Date.now() }),
            { qos: 0 },
          );
          return;
        }

        if (topic === topics.toTouchpad) {
          const signal = parseRemoteTouchpadSignal(payload);
          if (signal) {
            handleSignal(signal);
          }
        }
      });

      client.on("offline", () => {
        if (mqttClientRef.current !== client) {
          return;
        }
        if (dataChannelRef.current?.readyState === "open") {
          return;
        }
        setOkay(false);
        setMessage("Offline");
      });

      client.on("reconnect", () => {
        if (mqttClientRef.current !== client) {
          return;
        }
        if (dataChannelRef.current?.readyState === "open") {
          return;
        }
        setOkay(false);
        setMessage("Reconnecting");
      });

      client.on("error", (error: Error) => {
        if (mqttClientRef.current !== client) {
          return;
        }
        setMessage(error.message);
        setOkay(false);
      });

      await requestWakeLock();
    }).then();
  }, [
    clientIdRef,
    execute,
    handleDisconnect,
    handleSignal,
    publishPresence,
    refreshStatus,
    requestWakeLock,
    urlRef,
  ]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await requestWakeLock();
      } else {
        await releaseWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    handleVisibilityChange().then();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    return () => {
      handleDisconnect().then();
    };
  }, [handleDisconnect]);

  return (
    <div className={styles.wrapper}>
      <input
        disabled={connected}
        type="url"
        placeholder="MQTT server URL (signalling)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        disabled={connected}
        min={1}
        type="text"
        placeholder="Touch Pad Client ID"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      />
      <button
        disabled={loading}
        className={styles.button}
        onClick={handleButtonClick}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
      <div className={cls(styles.message, okay && styles.okay)}>{message}</div>
      <TouchPad onTouchUp={handleTouchUp} onTouchDown={handleTouchDown} />
    </div>
  );
}
