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
import cls from "classnames";
import mqtt, { MqttClient } from "mqtt";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import TouchPad from "../../component/TouchPad";
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

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const mqttClientRef = useRef<MqttClient | null>(null);
  const pingerTimerRef = useRef<number>(-1);

  const { loading, execute } = useLoading();

  const [connected, setConnected] = useState<boolean>(false);

  const [url, urlRef, setUrl] = useProxy<string>("mqtt://127.0.0.1:8080");
  const [clientId, clientIdRef, setClientId] = useProxy<string>("1234");

  const [message, setMessage] = useState<string>("Standby");
  const [okay, setOkay] = useState<boolean>(true);

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

  const handleTouchUp = useCallback((): void => {
    const client = mqttClientRef.current;
    if (!client) return;

    client.publish(`${clientIdRef.current}:keyup`, now());
  }, [clientIdRef]);

  const handleTouchDown = useCallback(() => {
    const client = mqttClientRef.current;
    if (!client) return;

    client.publish(`${clientIdRef.current}:keydown`, now());
  }, [clientIdRef]);

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

      client.on("connect", () => {
        setMessage("Connected");
        setOkay(true);
      });

      client.on("disconnect", () => {
        mqttClientRef.current = null;
        setConnected(false);
        setOkay(true);
        setMessage("Standby");
      });

      client.on("offline", () => {
        setMessage("Offline");
        setOkay(false);
      });

      client.on("reconnect", () => {
        setMessage("Reconnecting");
        setOkay(false);
      });

      client.on("error", (err: Error) => {
        setMessage(err.message);
        setOkay(false);
      });

      client.publish(`${clientIdRef.current}:new-client`, now());

      pingerTimerRef.current = setInterval(() => {
        client.sendPing();
      }, 5000) as unknown as number;

      setConnected(true);
      setMessage("Connected");
      setOkay(true);

      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    }).then();
  }, [clientIdRef, execute, urlRef]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }

      if (document.visibilityState === "visible") {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } else {
        await wakeLockRef.current?.release();
        wakeLockRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    handleVisibilityChange().then();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wakeLockRef.current?.release().then(() => {
        wakeLockRef.current = null;
      });
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
      <div className={cls(styles.message, okay && styles.okay)}>{message}</div>
      <TouchPad onTouchUp={handleTouchUp} onTouchDown={handleTouchDown} />
    </div>
  );
}
