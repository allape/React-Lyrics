import {
  ChangeEvent,
  DragEvent,
  HTMLProps,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react";

export interface IFileInputProps
  extends Omit<HTMLProps<HTMLInputElement>, "value" | "onChange"> {
  value?: string;
  onChange?: (v: string) => void;
  mime?: string;
}

export default function FileInput({
  value,
  onChange,
  mime = "audio/mpeg",
  ...props
}: IFileInputProps): ReactElement {
  const [text, setText] = useState<string>("");

  const handleChange = useCallback(
    (url: string) => {
      setText((old) => {
        if (old !== url && old?.startsWith("blob:")) {
          URL.revokeObjectURL(old);
        }
        return url;
      });
      onChange?.(url);
    },
    [onChange],
  );

  useEffect(() => {
    handleChange(value || "");
  }, [handleChange, value]);

  const handleBlur = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleChange(e.target.value);
    },
    [handleChange],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement> | DragEvent<HTMLInputElement>) => {
      e.preventDefault();

      const files =
        "dataTransfer" in e ? e.dataTransfer?.files : e.currentTarget?.files;
      const data = await files?.[0]?.arrayBuffer();

      if (!data) {
        return;
      }

      handleChange(URL.createObjectURL(new Blob([data], { type: mime })));
    },
    [handleChange, mime],
  );

  return (
    <>
      <input
        placeholder="Input URL or drop file here"
        {...props}
        value={text}
        onBlur={handleBlur}
        onChange={(e) => setText(e.target.value)}
        onDrop={handleFileChange}
      />
      <input type="file" onChange={handleFileChange} />
    </>
  );
}
