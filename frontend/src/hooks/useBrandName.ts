import { useMemo } from "react";

export const useBrandName = () => {
  return useMemo(() => {
    const hostname = window.location.hostname;
    if (hostname === "internal-vyom.indusnettechnologies.com") {
      return "Vyom Ai";
    }
    if (hostname === "demo.vilok.ai") {
      return "Vilok Ai";
    }
    return "Vyom Ai";
  }, []);
};