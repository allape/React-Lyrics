import { DragEvent, HTMLProps, ReactElement, useCallback } from "react";

export interface IDroppableTextareaProps
  extends Omit<HTMLProps<HTMLTextAreaElement>, "value" | "onChange"> {
  value?: string;
  onChange?: (v?: string) => void;
}

export default function DroppableTextarea({
  value,
  onChange,
  onDrop,
  ...props
}: IDroppableTextareaProps): ReactElement {
  const handleDrop = useCallback(
    async (e: DragEvent<HTMLTextAreaElement>) => {
      const file = e.dataTransfer.files[0];
      if (!file) {
        return;
      }

      e.preventDefault();

      const text = await file.text();

      onChange?.(text);
    },
    [onChange],
  );
  return (
    <textarea
      {...props}
      onDrop={onDrop || handleDrop}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    ></textarea>
  );
}
