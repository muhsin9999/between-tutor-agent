import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names, letting later Tailwind utilities win over
 * earlier ones of the same family. Every primitive routes its `className`
 * prop through this so consumers can always override.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
