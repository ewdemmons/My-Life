import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DisplayDensity = "compact" | "default" | "large";

const DENSITY_STORAGE_KEY = "@display_density";

export interface DensityConfig {
  titleFontSize: number;
  metaFontSize: number;
  cardPaddingVertical: number;
  cardPaddingHorizontal: number;
  useDepthScaling: boolean;
}

const COMPACT_CONFIG: DensityConfig = {
  titleFontSize: 15,
  metaFontSize: 12,
  cardPaddingVertical: 7,
  cardPaddingHorizontal: 7,
  useDepthScaling: true,
};

function getDensityConfig(density: DisplayDensity): DensityConfig {
  switch (density) {
    case "compact":
      return COMPACT_CONFIG;
    case "default":
      return {
        titleFontSize: Math.round(COMPACT_CONFIG.titleFontSize * 1.1),
        metaFontSize: Math.round(COMPACT_CONFIG.metaFontSize * 1.1),
        cardPaddingVertical: Math.round(COMPACT_CONFIG.cardPaddingVertical * 1.1),
        cardPaddingHorizontal: COMPACT_CONFIG.cardPaddingHorizontal,
        useDepthScaling: true,
      };
    case "large":
      return {
        titleFontSize: Math.round(COMPACT_CONFIG.titleFontSize * 1.2),
        metaFontSize: Math.round(COMPACT_CONFIG.metaFontSize * 1.2),
        cardPaddingVertical: Math.round(COMPACT_CONFIG.cardPaddingVertical * 1.2),
        cardPaddingHorizontal: COMPACT_CONFIG.cardPaddingHorizontal,
        useDepthScaling: false,
      };
  }
}

export function useDisplayDensity(): {
  density: DisplayDensity;
  setDensity: (d: DisplayDensity) => Promise<void>;
  config: DensityConfig;
  isLoaded: boolean;
} {
  const [density, setDensityState] = useState<DisplayDensity>("default");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DENSITY_STORAGE_KEY)
      .then((val) => {
        if (val === "compact" || val === "default" || val === "large") {
          setDensityState(val);
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  const setDensity = useCallback(async (d: DisplayDensity) => {
    setDensityState(d);
    await AsyncStorage.setItem(DENSITY_STORAGE_KEY, d);
  }, []);

  const config = useMemo(() => getDensityConfig(density), [density]);

  return { density, setDensity, config, isLoaded };
}

export default useDisplayDensity;
