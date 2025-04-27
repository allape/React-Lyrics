import { useEffect, useState } from "react";

export interface SrcTextFromSearchParams {
  src?: string;
  text?: string;
}

export default function useSrcTextFromSearchParams(): SrcTextFromSearchParams {
  const [src, setSrc] = useState<SrcTextFromSearchParams["src"]>(undefined);
  const [text, setText] = useState<SrcTextFromSearchParams["text"]>(undefined);

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
    };

    handleHashChange().then();

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return { src, text };
}
