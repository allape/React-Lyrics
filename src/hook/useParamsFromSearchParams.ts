import { useEffect, useState } from "react";

export interface ParamsFromSearchParamsReturn {
  src?: string;
  text?: string;
  remoteTouchpadURL?: string;
  remoteTouchpadClientID?: string;
}

export default function useParamsFromSearchParams(): ParamsFromSearchParamsReturn {
  const [src, setSrc] = useState<ParamsFromSearchParamsReturn["src"]>(undefined);
  const [text, setText] = useState<ParamsFromSearchParamsReturn["text"]>(undefined);
  const [remoteTouchpadURL, setRemoteTouchpadURL] =
    useState<ParamsFromSearchParamsReturn["remoteTouchpadURL"]>();
  const [remoteTouchpadClientID, setRemoteTouchpadClientID] =
    useState<ParamsFromSearchParamsReturn["remoteTouchpadClientID"]>();

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
    };

    handleHashChange().then();

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return { src, text, remoteTouchpadURL, remoteTouchpadClientID };
}
