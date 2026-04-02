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

export interface UseRemoteTouchPadProps {
  execute: UseLoadingReturn["execute"];

  remoteTouchpadURL?: string;
  remoteTouchpadClientID?: string;

  onTouchDown?: (offset?: number) => void;
  onTouchUp?: () => void;
}

export interface UseRemoteTouchPadReturn {
  remoteTouchpadURL: string;
  setRemoteTouchpadURL: Dispatch<SetStateAction<string>>;

  remoteTouchpadClientID: string;
  setRemoteTouchpadClientID: Dispatch<SetStateAction<string>>;

  remoteTouchpadConnected: boolean;

  connect: () => void;
}

export default function useRemoteTouchPad({
  remoteTouchpadURL: remoteTouchpadURLFromProps,
  remoteTouchpadClientID: remoteTouchpadClientIDFromProps,
  onTouchDown,
  onTouchUp,
  execute,
}: UseRemoteTouchPadProps): UseRemoteTouchPadReturn {
  const remoteTouchpadMqttClientRef = useRef<MqttClient | null>(null);
  const remoteTouchpadPingerTimerRef = useRef<number>(-1);

  const [remoteTouchpadURL, remoteTouchpadURLRef, setRemoteTouchpadURL] =
    useProxy<string>("mqtt://127.0.0.1:8080");
  const [
    remoteTouchpadClientID,
    remoteTouchpadClientIDRef,
    setRemoteTouchpadClientID,
  ] = useProxy<string>("1234");

  useEffect(() => {
    setRemoteTouchpadURL(remoteTouchpadURLFromProps || "");
  }, [remoteTouchpadURLFromProps, setRemoteTouchpadURL]);

  useEffect(() => {
    setRemoteTouchpadClientID(remoteTouchpadClientIDFromProps || "");
  }, [remoteTouchpadClientIDFromProps, setRemoteTouchpadClientID]);

  useEffect(() => {
    setRemoteTouchpadURL(`mqtt://${location.hostname}:8080`);
    setRemoteTouchpadClientID("1234");
  }, [setRemoteTouchpadClientID, setRemoteTouchpadURL]);

  const [remoteTouchpadConnected, setRemoteTouchpadConnected] =
    useState<boolean>(false);

  const handleRemoteTouchpadDisconnect = useCallback(async () => {
    clearInterval(remoteTouchpadPingerTimerRef.current);

    setRemoteTouchpadConnected(false);
    const client = remoteTouchpadMqttClientRef.current;
    if (!client || client.disconnected) {
      return;
    }

    await client.endAsync();
    remoteTouchpadMqttClientRef.current = null;
  }, []);

  const handleRemoteTouchpadClick = useCallback(() => {
    execute(async () => {
      if (remoteTouchpadMqttClientRef.current) {
        handleRemoteTouchpadDisconnect().then();
        return;
      }

      remoteTouchpadMqttClientRef.current = mqtt.connect(
        remoteTouchpadURLRef.current,
      );
      const client = remoteTouchpadMqttClientRef.current;

      client.on("connect", () => {
        setRemoteTouchpadConnected(true);
      });

      const NewClientTopic = `${remoteTouchpadClientIDRef.current}:new-client`;
      const DownTopic = `${remoteTouchpadClientIDRef.current}:keydown`;
      const UpTopic = `${remoteTouchpadClientIDRef.current}:keyup`;
      const PingTopic = `${remoteTouchpadClientIDRef.current}:ping`;
      const PongTopic = `${remoteTouchpadClientIDRef.current}:pong`;

      let pingTime = Date.now();
      let timeDiff = 0;

      client.subscribe([NewClientTopic, DownTopic, UpTopic]);
      client.on("message", (topic, message) => {
        if (topic === NewClientTopic) {
          pingTime = Date.now();
          client.publish(PingTopic, `${pingTime}`);
          return;
        }

        const now = Date.now();
        const serverTime = parseInt(message.toString()) || now;
        const diff = now + timeDiff - serverTime;

        // console.log("Received MQTT Message", topic, diff);

        switch (topic) {
          case DownTopic:
            onTouchDown?.(-diff);
            break;
          case UpTopic:
            onTouchUp?.();
            break;
          case PongTopic: {
            const delay = Date.now() - pingTime;
            timeDiff = pingTime - delay - serverTime;
            break;
          }
          default:
            console.warn(`Unknown topic: ${topic}`, message.toString());
        }
      });

      client.publish(PingTopic, `${pingTime}`);

      client.on("disconnect", () => {
        handleRemoteTouchpadDisconnect();
      });

      client.on("error", (err) => {
        console.error("MQTT Error:", err);
      });

      remoteTouchpadPingerTimerRef.current = setInterval(() => {
        client.sendPing();
      }, 5000) as unknown as number;

      setRemoteTouchpadConnected(true);
    }).then();
  }, [
    execute,
    handleRemoteTouchpadDisconnect,
    onTouchDown,
    onTouchUp,
    remoteTouchpadClientIDRef,
    remoteTouchpadURLRef,
  ]);

  useEffect(() => {
    return () => {
      handleRemoteTouchpadDisconnect().then();
    };
  }, [handleRemoteTouchpadDisconnect]);

  return {
    remoteTouchpadURL,
    setRemoteTouchpadURL,
    remoteTouchpadClientID,
    setRemoteTouchpadClientID,
    remoteTouchpadConnected,

    connect: handleRemoteTouchpadClick,
  };
}
