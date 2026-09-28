declare module "canvas-confetti" {
  /** A custom shape created by `confetti.shapeFromText` or `confetti.shapeFromPath`. */
  export interface Shape {
    type: "path" | "bitmap";
    [key: string]: unknown;
  }

  export interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    shapes?: Array<"square" | "circle" | "star" | Shape>;
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
    /** Keeps particles upright instead of tumbling (useful for emoji). */
    flat?: boolean;
  }

  export interface CreateTypes {
    (options?: Options): Promise<null> | null;
    reset: () => void;
  }

  const confetti: {
    (options?: Options): Promise<null> | null;
    reset: () => void;
    shapeFromText: (options: { text: string; scalar?: number; color?: string; fontFamily?: string }) => Shape;
  };
  export default confetti;
}
