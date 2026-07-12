interface PosterFallbackProps {
  posterSrc?: string;
  className?: string;
}

export function PosterFallback({ posterSrc, className }: PosterFallbackProps) {
  return (
    <div className={["lubirth-poster", className].filter(Boolean).join(" ")} aria-hidden="true">
      {posterSrc ? <img src={posterSrc} alt="" /> : null}
    </div>
  );
}
