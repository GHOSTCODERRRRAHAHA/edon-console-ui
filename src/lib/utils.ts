import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toolOp = (tool: unknown) => {
  if (!tool) return "N/A";
  if (typeof tool === "string") return tool;
  if (typeof tool === "object") {
    const candidate = tool as { op?: unknown; name?: unknown };
    if (typeof candidate.op === "string") return candidate.op;
    if (typeof candidate.name === "string") return candidate.name;
  }
  return "N/A";
};
