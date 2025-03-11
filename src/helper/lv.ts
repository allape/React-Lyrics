import { ReactNode } from "react";

export interface ILV<T extends number | string = string> {
  label: ReactNode;
  value: T;
}
