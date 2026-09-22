"use client";

import { motion } from "framer-motion";
import { VoteValue } from "@/lib/types";

interface PointCardProps {
  value: VoteValue;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function PointCard({ value, selected, disabled, onClick }: PointCardProps) {
  const displayValue = value === "☕" ? "☕" : String(value);
  const isSpecial = value === "?" || value === "☕";

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -4, boxShadow: "0 8px 25px rgba(13,115,119,0.15)" }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      animate={
        selected
          ? { scale: [1, 1.05, 1], boxShadow: "0 0 0 3px rgba(13,115,119,0.4)" }
          : { scale: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
      }
      transition={{ duration: 0.2 }}
      className={`relative flex h-16 w-12 items-center justify-center rounded-xl border-2 text-base font-bold transition-colors ${
        selected
          ? "border-primary bg-primary/5 text-primary"
          : disabled
            ? "border-gray-100 bg-gray-50 text-muted cursor-not-allowed"
            : "border-gray-200 bg-surface text-secondary hover:border-primary/50"
      } ${isSpecial ? "text-lg" : ""}`}
    >
      {displayValue}
    </motion.button>
  );
}
