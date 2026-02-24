import React, { useEffect, useRef } from "react";
import { useMotionValue, useReducedMotion, useSpring } from "motion/react";

export default function CountUpNumber({
  value,
  className = "",
  formatValue = (latest) => Math.round(latest).toLocaleString("en-US"),
}) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: reducedMotion ? 1000 : 180,
    damping: reducedMotion ? 200 : 22,
    mass: 0.8,
  });

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(motionValue.get());
    }

    if (reducedMotion) {
      if (ref.current) {
        ref.current.textContent = formatValue(Number(value) || 0);
      }
      return;
    }

    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });

    return () => unsubscribe();
  }, [formatValue, motionValue, reducedMotion, springValue, value]);

  useEffect(() => {
    motionValue.set(Number(value) || 0);
  }, [motionValue, value]);

  return <span className={className} ref={ref} />;
}
