"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent
} from "react";
import {
  miraLithChapters,
  normalizeMiraLithChapterHref,
  type MiraLithChapterIndex
} from "../content/miraLithChapters";
import { preloadChapterTarget } from "./chapter-transition/preloadChapterTarget";
import { useChapterTransition } from "./chapter-transition/ChapterTransitionProvider";

interface MiraLithChapterNavigationProps {
  activeIndex: MiraLithChapterIndex;
  interactive: boolean;
  className?: string;
  compactClassName?: string;
  chapterHrefs?: Partial<Record<MiraLithChapterIndex, string>>;
  reserveActiveTitle?: boolean;
  terminal?: boolean;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function MiraLithChapterNavigation({
  activeIndex,
  interactive,
  className,
  compactClassName,
  chapterHrefs,
  reserveActiveTitle = false,
  terminal = false
}: MiraLithChapterNavigationProps) {
  const router = useRouter();
  const {
    beginTransition,
    getNextAccessibleChapter,
    resolveChapterAccess,
    snapshot
  } = useChapterTransition();
  const activeChapter = miraLithChapters.find((chapter) => chapter.index === activeIndex) ?? miraLithChapters[0];
  const visibleChapters = useMemo(
    () => miraLithChapters.filter((chapter) => resolveChapterAccess(chapter.href).visibleInNavigation),
    [resolveChapterAccess]
  );
  const visibleChapterIndexes = useMemo(
    () => new Set(visibleChapters.map((chapter) => chapter.index)),
    [visibleChapters]
  );
  const resolvedChapterHrefs = useMemo(() => ({
    ...Object.fromEntries(visibleChapters.map((chapter) => [chapter.index, chapter.href])),
    ...chapterHrefs
  }) as Partial<Record<MiraLithChapterIndex, string>>, [chapterHrefs, visibleChapters]);
  const activeHref = resolvedChapterHrefs[activeChapter.index];
  const nextChapter = useMemo(
    () => getNextAccessibleChapter(activeChapter.href),
    [activeChapter.href, getNextAccessibleChapter]
  );
  const showTerminal = Boolean(terminal && nextChapter && snapshot.state === "idle");
  const preloadTarget = useCallback((href: string) => {
    void preloadChapterTarget(router, resolveChapterAccess(href));
  }, [resolveChapterAccess, router]);
  const handleLinkClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    const anchor = event.currentTarget;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.target && anchor.target !== "_self" ||
      anchor.hasAttribute("download") ||
      anchor.origin !== window.location.origin
    ) {
      return;
    }

    const targetAccess = resolveChapterAccess(anchor.href);
    if (!targetAccess.chapter || !targetAccess.coordinatorAllowed) {
      return;
    }
    if (!snapshot.inputEnabled) {
      event.preventDefault();
      return;
    }
    const currentPathname = normalizeMiraLithChapterHref(window.location.pathname);
    if (currentPathname === targetAccess.chapter.href) {
      return;
    }

    const transitionId = beginTransition(targetAccess.chapter.href, "link");
    if (transitionId) {
      event.preventDefault();
    }
  }, [beginTransition, resolveChapterAccess, snapshot.inputEnabled]);
  const handlePointerIntent = useCallback((event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "touch") {
      preloadTarget(event.currentTarget.href);
    }
  }, [preloadTarget]);
  const handleTouchIntent = useCallback((event: TouchEvent<HTMLAnchorElement>) => {
    preloadTarget(event.currentTarget.href);
  }, [preloadTarget]);

  useEffect(() => {
    if (interactive && nextChapter) {
      preloadTarget(nextChapter.href);
    }
  }, [interactive, nextChapter, preloadTarget]);

  const transitionLinkProps = {
    onClick: handleLinkClick,
    onPointerEnter: handlePointerIntent,
    onFocus: (event: FocusEvent<HTMLAnchorElement>) => preloadTarget(event.currentTarget.href),
    onTouchStart: handleTouchIntent
  };
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
        data-chapter-terminal={showTerminal ? "armed" : "idle"}
        inert={interactive ? undefined : true}
      >
        {showTerminal && nextChapter ? (
          <div className="miralith-chapter-nav__terminal">
            <span>Scroll to continue</span>
            <a href={nextChapter.href} aria-label={`Continue to ${nextChapter.index} ${nextChapter.title}`} {...transitionLinkProps}>
              <b>{nextChapter.index}</b>
              <strong>{nextChapter.title}</strong>
            </a>
          </div>
        ) : null}
        <ol>
          {miraLithChapters.map((chapter) => {
            const isActive = chapter.index === activeChapter.index;
            const isVisibleInNavigation = visibleChapterIndexes.has(chapter.index);
            const href = isVisibleInNavigation ? resolvedChapterHrefs[chapter.index] : undefined;
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
              <li
                key={chapter.index}
                data-active={isActive ? "true" : "false"}
                data-published={chapter.availability === "published" ? "true" : "false"}
                data-visible-in-navigation={isVisibleInNavigation ? "true" : "false"}
                aria-hidden={isVisibleInNavigation ? undefined : true}
              >
                {href ? (
                  <a
                    className="miralith-chapter-nav__link"
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`${chapter.index} ${chapter.title}${isActive ? ` ${chapter.zh}` : ""}`}
                    tabIndex={interactive ? undefined : -1}
                    {...transitionLinkProps}
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
        data-chapter-terminal={showTerminal ? "armed" : "idle"}
        inert={interactive ? undefined : true}
      >
        <div className="miralith-chapter-bar__current">
          {activeHref ? (
            <a
              href={activeHref}
              aria-current="page"
              tabIndex={interactive ? undefined : -1}
              {...transitionLinkProps}
            >
              {compactContent}
            </a>
          ) : (
            <span className="miralith-chapter-bar__link" aria-current="page">
              {compactContent}
            </span>
          )}
        </div>
        {showTerminal && nextChapter ? (
          <a
            className="miralith-chapter-bar__terminal"
            href={nextChapter.href}
            aria-label={`Continue to ${nextChapter.index} ${nextChapter.title}`}
            {...transitionLinkProps}
          >
            <span>Scroll to continue</span>
            <strong>{nextChapter.index} / {nextChapter.title}</strong>
          </a>
        ) : null}
      </nav>
    </>
  );
}
