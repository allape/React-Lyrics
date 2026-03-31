import cls from "classnames";
import { HTMLProps, ReactElement, useEffect, useState } from "react";
import styles from "./style.module.scss";

export interface ITouchPadProps extends HTMLProps<HTMLDivElement> {
  onTouchDown?: () => void;
  onTouchUp?: () => void;
}

export default function TouchPad({
  onTouchDown,
  onTouchUp,
  children,
  className,
  ...props
}: ITouchPadProps): ReactElement {
  const [touchpad, setTouchpad] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!touchpad) return;

    const handleUp = (): void => {
      onTouchUp?.();
    };

    const handleDown = () => {
      onTouchDown?.();
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
  }, [onTouchDown, onTouchUp, touchpad]);

  return (
    <div
      ref={setTouchpad}
      {...props}
      className={cls(styles.touchpad, className)}
    >
      {children || "Touch Pad"}
    </div>
  );
}
