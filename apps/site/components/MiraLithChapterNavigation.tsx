import {
  miraLithChapters,
  type MiraLithChapterIndex
} from "../content/miraLithChapters";

interface MiraLithChapterNavigationProps {
  activeIndex: MiraLithChapterIndex;
  interactive: boolean;
  className?: string;
  compactClassName?: string;
  chapterHrefs?: Partial<Record<MiraLithChapterIndex, string>>;
  reserveActiveTitle?: boolean;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function MiraLithChapterNavigation({
  activeIndex,
  interactive,
  className,
  compactClassName,
  chapterHrefs = {},
  reserveActiveTitle = false
}: MiraLithChapterNavigationProps) {
  const activeChapter = miraLithChapters.find((chapter) => chapter.index === activeIndex) ?? miraLithChapters[0];
  const activeHref = chapterHrefs[activeChapter.index];
  const activeTitle = (
    <span className="miralith-chapter-bar__title-anchor" aria-hidden={reserveActiveTitle ? "true" : undefined}>
      <span className={reserveActiveTitle ? "miralith-chapter-bar__title-placeholder" : undefined}>
        {activeChapter.title}
      </span>
    </span>
  );
  const compactContent = (
    <>
      <span className="miralith-chapter-bar__main">
        <span className="miralith-chapter-bar__index">{activeChapter.index}</span>
        {activeTitle}
      </span>
      <span className="miralith-chapter-bar__detail">
        {activeChapter.zh} / <span>{activeChapter.en}</span>
      </span>
    </>
  );

  return (
    <>
      <nav
        className={joinClassNames("miralith-chapter-nav", className)}
        aria-label="MiraLith chapters"
        aria-hidden={interactive ? undefined : "true"}
        data-active-index={activeIndex}
        inert={interactive ? undefined : true}
      >
        <ol>
          {miraLithChapters.map((chapter) => {
            const isActive = chapter.index === activeChapter.index;
            const href = chapterHrefs[chapter.index];
            const title = isActive ? (
              <span
                className="miralith-chapter-nav__title-anchor"
                aria-hidden={reserveActiveTitle ? "true" : undefined}
              >
                <span className={reserveActiveTitle ? "miralith-chapter-nav__title-placeholder" : undefined}>
                  {chapter.title}
                </span>
              </span>
            ) : (
              <span className="miralith-chapter-nav__title">{chapter.title}</span>
            );
            const content = (
              <>
                <span className="miralith-chapter-nav__index">{chapter.index}</span>
                <span className="miralith-chapter-nav__copy">
                  {title}
                  {isActive ? (
                    <span className="miralith-chapter-nav__meta">
                      {chapter.zh} / <span>{chapter.en}</span>
                    </span>
                  ) : null}
                </span>
              </>
            );

            return (
              <li key={chapter.index} data-active={isActive ? "true" : "false"}>
                {href ? (
                  <a
                    className="miralith-chapter-nav__link"
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`${chapter.index} ${chapter.title}${isActive ? ` ${chapter.zh}` : ""}`}
                    tabIndex={interactive ? undefined : -1}
                  >
                    {content}
                  </a>
                ) : (
                  <span className="miralith-chapter-nav__link" aria-disabled="true" tabIndex={-1}>
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <nav
        className={joinClassNames("miralith-chapter-bar", compactClassName)}
        aria-label="Current MiraLith chapter"
        aria-hidden={interactive ? undefined : "true"}
        data-active-index={activeIndex}
        inert={interactive ? undefined : true}
      >
        {activeHref ? (
          <a href={activeHref} aria-current="page" tabIndex={interactive ? undefined : -1}>
            {compactContent}
          </a>
        ) : (
          <span className="miralith-chapter-bar__link" aria-current="page">
            {compactContent}
          </span>
        )}
      </nav>
    </>
  );
}
