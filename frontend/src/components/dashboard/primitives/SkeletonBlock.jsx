import React from "react";

export default function SkeletonBlock({ className = "", ...props }) {
  return (
    <div
      className={`dashboard-skeleton rounded-md ${className}`.trim()}
      aria-hidden="true"
      {...props}
    />
  );
}
