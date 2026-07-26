import type { CSSProperties } from "react";
import type { ChapterTransitionSnapshot } from "./chapterTransitionTypes";

interface ChapterTransitionVisualProps {
  snapshot: ChapterTransitionSnapshot;
}

const transitionParticles = Array.from({ length: 14 }, (_, index) => index);
const sutraThreads = Array.from({ length: 7 }, (_, index) => index);

export function ChapterTransitionVisual({ snapshot }: ChapterTransitionVisualProps) {
  const target = snapshot.targetChapter;

  return (
    <div className="chapter-transition-visual" data-variant={snapshot.kind ?? "direct"}>
      <div className="chapter-transition-visual__grain" />
      <div className="chapter-transition-visual__vignette" />

      <div className="chapter-transition-visual__signal" aria-hidden="true">
        <span className="chapter-transition-visual__signal-line" />
        <span className="chapter-transition-visual__signal-scan" />
        <span className="chapter-transition-visual__signal-node" />
      </div>

      <div className="chapter-transition-visual__particles" aria-hidden="true">
        {transitionParticles.map((index) => (
          <span
            key={index}
            style={{
              "--particle-offset": `${(index - 6.5) * 5.7}vw`,
              "--particle-x": `${(6.5 - index) * 5.7}vw`,
              "--particle-top": `${18 + index * 4.6}%`,
              "--particle-y": `${32 - index * 4.6}vh`,
              "--particle-delay": `${index * 18}ms`
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="chapter-transition-visual__threads" aria-hidden="true">
        {sutraThreads.map((index) => (
          <span
            key={index}
            style={{
              "--thread-left": `${12.5 + index * 12.5}%`,
              "--thread-delay": `${180 + index * 36}ms`
            } as CSSProperties}
          />
        ))}
      </div>

      {target ? (
        <div className="chapter-transition-visual__marker">
          <span className="chapter-transition-visual__index">{target.index}</span>
          <span className="chapter-transition-visual__eyebrow">{target.en}</span>
          <strong>{target.title}</strong>
        </div>
      ) : null}
    </div>
  );
}
