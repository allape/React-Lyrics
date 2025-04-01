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
  onFile?: (fileOrURL: ArrayBuffer | string) => Promise<string> | string;
}

export default function FileInput({
  value,
  onChange,
  onFile,
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
    async (e: ChangeEvent<HTMLInputElement>) => {
      let url = e.target.value;
      if (onFile) {
        url = (await onFile(url)) || url;
      }
      handleChange(url);
    },
    [handleChange, onFile],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement> | DragEvent<HTMLInputElement>) => {
      e.preventDefault();

      const files =
        "dataTransfer" in e ? e.dataTransfer?.files : e.currentTarget?.files;
      const file = files?.[0];

      if (!file) {
        return;
      }

      const data = await file.arrayBuffer();

      if (!data) {
        return;
      }

      let url = "";

      if (onFile) {
        url = await onFile(data);
      }

      if (!url) {
        url = URL.createObjectURL(new Blob([data], { type: file.type }));
      }

      handleChange(url);
    },
    [handleChange, onFile],
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
