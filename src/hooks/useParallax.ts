import { useScroll, useTransform, MotionValue } from "framer-motion";

export const useParallax = (distance: number = 50) => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, distance]);

  return y;
};

export const useParallaxValue = (
  scrollY: MotionValue<number>,
  distance: number = 50,
  range: [number, number] = [0, 1000]
) => {
  return useTransform(scrollY, range, [0, distance]);
};




