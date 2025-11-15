import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export const useScrollReveal = (options?: {
  threshold?: number;
  once?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    once: options?.once ?? true,
    amount: options?.threshold ?? 0.15, // Default to 0.15 for better trigger point
  });

  return { ref, isInView };
};

export const scrollRevealVariants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItemVariants = {
  hidden: {
    opacity: 0,
    y: 18, // Slight slide up from below
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.2, 0.9, 0.3, 1], // cubic-bezier for smooth easing
    },
  },
};

