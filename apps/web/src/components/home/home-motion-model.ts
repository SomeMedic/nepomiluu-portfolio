export const MIN_PIN_VIEWPORT_HEIGHT = 680;

/** A new chapter warms the whole paper while its boundary crosses the middle of the viewport. */
export function chapterTransitionProgress(scrollY: number, boundaryY: number, viewportHeight: number): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(boundaryY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  return boundedProgress((scrollY - boundaryY + viewportHeight * .8) / (viewportHeight * .6));
}

export function boundedProgress(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Three equal reading intervals; the middle scene is centred at progress 0.5. */
export function stageAtProgress(progress: number, count = 3): number {
  const stages = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  return Math.min(stages - 1, Math.floor(boundedProgress(progress) * stages));
}

export function stageProgressCenter(index: number, count = 3): number {
  const stages = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  const stage = Math.max(0, Math.min(stages - 1, Math.floor(Number.isFinite(index) ? index : 0)));
  return (stage + 0.5) / stages;
}

export function stageScrollTarget(start: number, end: number, index: number, count = 3): number {
  return start + Math.max(0, end - start) * stageProgressCenter(index, count);
}

/** Native scrolling stops at the document edge, including short footer destinations. */
export function clampScrollTarget(target: number, scrollHeight: number, viewportHeight: number): number {
  return Math.max(0, Math.min(target, Math.max(0, scrollHeight - viewportHeight)));
}

export function canPinScene({ viewportHeight, contentHeight, reducedMotion = false, stages = 3 }: { viewportHeight: number; contentHeight: number; reducedMotion?: boolean; stages?: number }): boolean {
  return !reducedMotion && stages === 3 && Number.isFinite(viewportHeight) && Number.isFinite(contentHeight)
    && viewportHeight >= MIN_PIN_VIEWPORT_HEIGHT && contentHeight > 0 && contentHeight <= viewportHeight + 2;
}

export function pinScrollDistance(viewportHeight: number, percent: number): number {
  return Math.max(0, viewportHeight) * (Number.isFinite(percent) && percent > 0 ? percent : 180) / 100;
}

export function parseStageHash(hash: string): { scene: string; stage: number } | null {
  const match = /^#(clypse|fomina|logic|process)-stage-([012])$/.exec(hash);
  return match ? { scene: match[1]!, stage: Number(match[2]) } : null;
}
