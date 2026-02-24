import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { dashboardAnimationConfig, withReducedMotion } from "../animationsConfig.js";

export function FadeInStagger({ children, className = "" }) {
  const reducedMotion = useReducedMotion();

  const variants = reducedMotion
    ? {}
    : {
        hidden: {},
        visible: {
          transition: {
            staggerChildren: dashboardAnimationConfig.stagger.page,
          },
        },
      };

  return (
    <motion.div className={className} initial="hidden" animate="visible" variants={variants}>
      {children}
    </motion.div>
  );
}

export function FadeInItem({ children, className = "" }) {
  const reducedMotion = useReducedMotion();

  const variants = reducedMotion
    ? {}
    : {
        hidden: {
          opacity: 0,
          y: 12,
        },
        visible: {
          opacity: 1,
          y: 0,
          transition: withReducedMotion(reducedMotion, {
            duration: dashboardAnimationConfig.duration.normal,
            ease: dashboardAnimationConfig.ease.enter,
          }),
        },
      };

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
