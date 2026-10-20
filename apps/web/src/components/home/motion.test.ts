import { describe, expect, it } from 'vitest';
import { boundedProgress, canPinScene, chapterTransitionProgress, clampScrollTarget, MIN_PIN_VIEWPORT_HEIGHT, parseStageHash, pinScrollDistance, stageAtProgress, stageProgressCenter, stageScrollTarget } from './home-motion-model';

describe('scroll story stage model', () => {
  it('keeps the shared paper transition continuous and reversible at both desktop sizes', () => {
    for (const height of [1080, 1440]) {
      const boundary = 8000;
      const offsets = [.9, .8, .65, .5, .35, .2, .1];
      const forward = offsets.map(offset => chapterTransitionProgress(boundary - height * offset, boundary, height));
      expect(forward).toEqual([0, 0, .25, .5, .75, 1, 1]);
      const backward = [...offsets].reverse().map(offset => chapterTransitionProgress(boundary - height * offset, boundary, height));
      expect(backward).toEqual([...forward].reverse());
    }
    expect(chapterTransitionProgress(100, 0, 0)).toBe(0);
    expect(chapterTransitionProgress(Number.NaN, 0, 1080)).toBe(0);
  });
  it('keeps each stage readable for one third of the scene, including both endpoints', () => {
    expect(stageAtProgress(0)).toBe(0);
    expect(stageAtProgress(1 / 3 - 0.00001)).toBe(0);
    expect(stageAtProgress(1 / 3)).toBe(1);
    expect(stageAtProgress(0.5)).toBe(1);
    expect(stageAtProgress(2 / 3 - 0.00001)).toBe(1);
    expect(stageAtProgress(2 / 3)).toBe(2);
    expect(stageAtProgress(1)).toBe(2);
  });

  it('saturates overscroll and rejects invalid progress instead of selecting missing stages', () => {
    expect(stageAtProgress(-0.2)).toBe(0);
    expect(stageAtProgress(1.5)).toBe(2);
    expect(stageAtProgress(Number.NaN)).toBe(0);
    expect(boundedProgress(Number.POSITIVE_INFINITY)).toBe(0);
    expect(stageAtProgress(0.99, 2)).toBe(1);
    expect(stageAtProgress(0.8, 0)).toBe(0);
  });

  it('maps every stage anchor to the middle of its own reading interval', () => {
    for (let index = 0; index < 3; index++) expect(stageAtProgress(stageProgressCenter(index))).toBe(index);
    expect(stageProgressCenter(1)).toBe(0.5);
    expect(stageScrollTarget(1000, 2800, 1)).toBe(1900);
    expect(stageScrollTarget(1000, 2800, 2)).toBe(2500);
    expect(stageScrollTarget(1000, 500, 1)).toBe(1000);
  });

  it('keeps anchor destinations reachable when the footer is shorter than the viewport', () => {
    expect(clampScrollTarget(1900, 2400, 1000)).toBe(1400);
    expect(clampScrollTarget(900, 2400, 1000)).toBe(900);
    expect(clampScrollTarget(-10, 2400, 1000)).toBe(0);
    expect(clampScrollTarget(400, 600, 1000)).toBe(0);
  });

  it('allows pins only when the complete staged layout fits a sufficiently tall viewport', () => {
    expect(canPinScene({ viewportHeight: MIN_PIN_VIEWPORT_HEIGHT, contentHeight: 680 })).toBe(true);
    expect(canPinScene({ viewportHeight: 679, contentHeight: 500 })).toBe(false);
    expect(canPinScene({ viewportHeight: 900, contentHeight: 902 })).toBe(true);
    expect(canPinScene({ viewportHeight: 900, contentHeight: 903 })).toBe(false);
    expect(canPinScene({ viewportHeight: 900, contentHeight: 700, reducedMotion: true })).toBe(false);
    expect(canPinScene({ viewportHeight: 900, contentHeight: 700, stages: 2 })).toBe(false);
    expect(canPinScene({ viewportHeight: 900, contentHeight: 0 })).toBe(false);
    expect(canPinScene({ viewportHeight: Number.NaN, contentHeight: 700 })).toBe(false);
  });

  it('uses native scroll distances of 180 or 120 viewport percent', () => {
    expect(pinScrollDistance(1000, 180)).toBe(1800);
    expect(pinScrollDistance(1000, 120)).toBe(1200);
  });

  it('recognises only supported stage hashes and valid stage indices', () => {
    expect(parseStageHash('#clypse-stage-1')).toEqual({ scene: 'clypse', stage: 1 });
    expect(parseStageHash('#fomina-stage-0')).toEqual({ scene: 'fomina', stage: 0 });
    expect(parseStageHash('#fomina-stage-2')).toEqual({ scene: 'fomina', stage: 2 });
    expect(parseStageHash('#process-stage-2')).toEqual({ scene: 'process', stage: 2 });
    expect(parseStageHash('#logic-stage-0')).toEqual({ scene: 'logic', stage: 0 });
    expect(parseStageHash('#process-stage-3')).toBeNull();
    expect(parseStageHash('#fomina-stage-3')).toBeNull();
    expect(parseStageHash('#footer')).toBeNull();
  });
});
