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

 */

import { useLoading, useProxy } from "@allape/use-loading";
import mqtt, { MqttClient } from "mqtt";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import useParamsFromSearchParams from "../../hook/useParamsFromSearchParams.ts";
import styles from "./style.module.scss";

function now(): string {
  return `${Date.now()}`;
}

export default function RemoteTouchpad(): ReactElement {
  const {
    remoteTouchpadURL: remoteTouchpadURLFromProps,
    remoteTouchpadClientID: remoteTouchpadClientIDFromProps,
  } = useParamsFromSearchParams();

  const mqttClientRef = useRef<MqttClient | null>(null);
  const pingerTimerRef = useRef<number>(-1);

  const { loading, execute } = useLoading();

  const [connected, setConnected] = useState<boolean>(false);
  const [touchpad, setTouchpad] = useState<HTMLElement | null>(null);

  const [url, urlRef, setUrl] = useProxy<string>("mqtt://127.0.0.1:8080");
  const [clientId, clientIdRef, setClientId] = useProxy<string>("1234");

  const [message, setMessage] = useState<string>("Standby");

  useEffect(() => {
    setUrl(remoteTouchpadURLFromProps || "");
  }, [remoteTouchpadURLFromProps, setUrl]);

  useEffect(() => {
    setClientId(remoteTouchpadClientIDFromProps || "");
  }, [remoteTouchpadClientIDFromProps, setClientId]);

  useEffect(() => {
    setUrl(`mqtt://${location.hostname}:8080`);
    // setClientId(`${Math.floor(Math.random() * 1000)}`.padStart(4, "0"));
    setClientId("1234");
  }, [setClientId, setUrl]);

  useEffect(() => {
    if (!touchpad) return;

    const handleUp = (): void => {
      const client = mqttClientRef.current;
      if (!client) return;

      client.publish(`${clientIdRef.current}:keyup`, now());
    };

    const handleDown = () => {
      const client = mqttClientRef.current;
      if (!client) return;

      client.publish(`${clientIdRef.current}:keydown`, now());
    };

    const handleDownEvent = (e: Event): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleDown();
    };

    const handleUpEvent = (e: Event): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleUp();
    };

    touchpad.addEventListener("touchstart", handleDownEvent, true);
    touchpad.addEventListener("touchend", handleUpEvent, true);

    touchpad.addEventListener("mousedown", handleDownEvent, true);
    touchpad.addEventListener("mouseup", handleUpEvent, true);

    window.addEventListener("blur", handleUp);

    return () => {
      touchpad.removeEventListener("touchstart", handleDownEvent, true);
      touchpad.removeEventListener("touchend", handleUpEvent, true);

      touchpad.removeEventListener("mousedown", handleDownEvent, true);
      touchpad.removeEventListener("mouseup", handleUpEvent, true);

      window.removeEventListener("blur", handleUp);
    };
  }, [clientIdRef, touchpad]);

  useEffect(() => {
    return () => {
      mqttClientRef.current?.end();
      clearInterval(pingerTimerRef.current);
    };
  }, []);

  const handleButtonClick = useCallback(() => {
    execute(async () => {
      if (mqttClientRef.current) {
        clearInterval(pingerTimerRef.current);
        await mqttClientRef.current.endAsync();
        mqttClientRef.current = null;
        setConnected(false);
        setMessage("Disconnected");
        return;
      }

      setMessage("Connecting");

      mqttClientRef.current = mqtt.connect(urlRef.current);
      const client = mqttClientRef.current;

      client.on("message", (topic) => {
        if (topic === `${clientIdRef.current}:ping`) {
          client.publish(`${clientIdRef.current}:pong`, now());
        }
      });

      client.on("disconnect", () => {
        mqttClientRef.current = null;
        setConnected(false);
      });

      client.on("error", (err: Error) => {
        setMessage(err.message);
      });

      pingerTimerRef.current = setInterval(() => {
        client.sendPing();
      }, 5000) as unknown as number;

      setConnected(true);
      setMessage("Connected");
    }).then();
  }, [clientIdRef, execute, urlRef]);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
      } else {
        await wakeLock?.release();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    handleVisibilityChange().then();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wakeLock?.release().then();
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <input
        disabled={connected}
        type="url"
        placeholder="MQTT server URL"
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
      <div className={styles.message}>{message}</div>
      <div ref={setTouchpad} className={styles.touchpad}>
        Touch Pad
      </div>
    </div>
  );
}
