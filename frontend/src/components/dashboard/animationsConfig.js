export const dashboardAnimationConfig = {
  duration: {
    fast: 0.16,
    normal: 0.22,
    slow: 0.32,
    count: 0.9,
    chart: 0.7,
  },
  ease: {
    standard: [0.2, 0.8, 0.2, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.4, 0, 0.2, 1],
  },
  stagger: {
    page: 0.06,
    list: 0.04,
    chips: 0.05,
  },
  spring: {
    type: "spring",
    stiffness: 320,
    damping: 24,
    mass: 0.5,
  },
};

export function withReducedMotion(reducedMotion, transition) {
  if (reducedMotion) {
    return { duration: 0 };
  }
  return transition;
}
