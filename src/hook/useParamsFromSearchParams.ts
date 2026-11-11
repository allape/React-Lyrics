import { useEffect, useState } from "react";
import { parseRemoteTouchpadIceServers } from "../core/remoteTouchpad.ts";

export interface ParamsFromSearchParamsReturn {
  src?: string;
  text?: string;
  remoteTouchpadURL?: string;
  remoteTouchpadClientID?: string;
  remoteTouchpadIceServers?: RTCIceServer[];
}

export default function useParamsFromSearchParams(): ParamsFromSearchParamsReturn {
  const [src, setSrc] =
    useState<ParamsFromSearchParamsReturn["src"]>(undefined);
  const [text, setText] =
    useState<ParamsFromSearchParamsReturn["text"]>(undefined);
  const [remoteTouchpadURL, setRemoteTouchpadURL] =
    useState<ParamsFromSearchParamsReturn["remoteTouchpadURL"]>();
  const [remoteTouchpadClientID, setRemoteTouchpadClientID] =
    useState<ParamsFromSearchParamsReturn["remoteTouchpadClientID"]>();
  const [remoteTouchpadIceServers, setRemoteTouchpadIceServers] =
    useState<ParamsFromSearchParamsReturn["remoteTouchpadIceServers"]>();

  useEffect(() => {
    const handleHashChange = async () => {
      const sp = new URLSearchParams(window.location.search);
      setSrc(sp.get("src") || undefined);

      let text = sp.get("text") || undefined;
      if (text?.startsWith("http")) {
        try {
          text = await (await fetch(text)).text();
        } catch (e) {
          alert(`${(e as Error)?.message || e}`);
        }
      }
      setText(text);

      setRemoteTouchpadURL(sp.get("remoteTouchpadURL") || undefined);
      setRemoteTouchpadClientID(sp.get("remoteTouchpadClientID") || undefined);
      setRemoteTouchpadIceServers(
        parseRemoteTouchpadIceServers(sp.get("remoteTouchpadIceServers")),
      );
    };

    handleHashChange().then();

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return {
    src,
    text,
    remoteTouchpadURL,
    remoteTouchpadClientID,
    remoteTouchpadIceServers,
  };
}
