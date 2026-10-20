'use client';

import type { RefObject } from 'react';
import type { Locale } from '@portfolio/contracts';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { canPinScene, chapterTransitionProgress, clampScrollTarget, MIN_PIN_VIEWPORT_HEIGHT, parseStageHash, pinScrollDistance, stageAtProgress, stageScrollTarget } from './home-motion-model';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const historyMarker = '__portfolioHomePosition';
interface SavedPosition { path: string; locale: Locale; y: number }
interface ScenePlan { section: HTMLElement; name: string; stages: HTMLElement[]; steps: HTMLElement[]; activate: (stage: number) => void }

/** Progressive enhancement only: the server-rendered page remains readable without this hook. */
export function useHomeMotion(root: RefObject<HTMLElement | null>, locale: Locale): void {
  useGSAP(() => {
    const host = root.current;
    if (!host) return;
    const element: HTMLElement = host;
    const path = window.location.pathname;
    const storageKey = `portfolio:home-scroll:${locale}`;
    const triggers = new Map<string, ScrollTrigger>();
    const revealed = new WeakSet<HTMLElement>();
    let disposed = false;
    let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
    let rebuildPosition: { y: number; scene: { name: string; progress: number } | null } | null = null;
    let frame = 0;
    let restoreFrame = 0;
    let anchorFrame = 0;
    let pendingAnchor: string | null = null;
    let media: gsap.MatchMedia | undefined;
    let restoring = false;
    let restored = false;

    function persistPosition() {
      if (disposed || restoring || window.location.pathname !== path) return;
      const position: SavedPosition = { path, locale, y: Math.max(0, window.scrollY) };
      try { window.sessionStorage.setItem(storageKey, JSON.stringify(position)); } catch { /* Storage can be unavailable in private browser contexts. */ }
      const state = window.history.state;
      if (state && typeof state === 'object') window.history.replaceState({ ...state, [historyMarker]: position }, '');
    }

    function rememberedPosition(): SavedPosition | null {
      const state = window.history.state as Record<string, unknown> | null;
      const marker = state?.[historyMarker] as Partial<SavedPosition> | undefined;
      if (marker?.path === path && marker.locale === locale && Number.isFinite(marker.y)) return marker as SavedPosition;
      // A fresh visit must begin normally; session storage is used only for a genuine browser history restoration.
      const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navigation?.type !== 'back_forward') return null;
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null') as Partial<SavedPosition> | null;
        return saved?.path === path && saved.locale === locale && Number.isFinite(saved.y) ? saved as SavedPosition : null;
      } catch { return null; }
    }
    const remembered = rememberedPosition();

    function numericAnchorTarget(target: HTMLElement, hash: string): number {
      const stage = parseStageHash(hash);
      const scene = stage ? triggers.get(stage.scene) : target.matches('[data-scene]') ? triggers.get(target.dataset.scene || '') : undefined;
      const nativeOffset = stage && !scene
        ? (Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0) + (Number.parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
        : 0;
      const top = scene ? stage ? stageScrollTarget(scene.start, scene.end, stage.stage) : scene.start : window.scrollY + target.getBoundingClientRect().top - nativeOffset;
      return clampScrollTarget(top, document.documentElement.scrollHeight, window.innerHeight);
    }

    function onRefresh() {
      if (!pendingAnchor || disposed) return;
      const hash = pendingAnchor;
      window.cancelAnimationFrame(anchorFrame);
      anchorFrame = window.requestAnimationFrame(() => {
        if (disposed || pendingAnchor !== hash) return;
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (!target) { pendingAnchor = null; return; }
        // Refresh writes the current scroll offset and interrupts native smooth scrolling.
        // Resolve the destination again after all pins have their new numeric positions.
        window.scrollTo({ top: Math.max(0, numericAnchorTarget(target, hash)), behavior: 'instant' });
        ScrollTrigger.update();
      });
    }

    function cancelAnchor() {
      pendingAnchor = null;
      window.cancelAnimationFrame(anchorFrame);
    }

    function onScrollEnd() {
      if (pendingAnchor) {
        const target = document.getElementById(decodeURIComponent(pendingAnchor.slice(1)));
        if (target && Math.abs(window.scrollY - numericAnchorTarget(target, pendingAnchor)) > 2) return;
        // A completed native jump still owns the destination while a queued
        // layout rebuild can collapse flow stages or change the pin ranges.
        if (!rebuildTimer) cancelAnchor();
      }
      persistPosition();
    }

    function onNavigationInput() {
      cancelAnchor();
      rebuildPosition = null;
    }

    function onNavigationKey(event: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) onNavigationInput();
    }

    function restoreInitialPosition() {
      if (disposed || restored) return;
      restored = true;
      let y = remembered?.y;
      if (y === undefined && window.location.hash) {
        let id = '';
        try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
        const target = document.getElementById(id);
        if (target && element?.contains(target)) y = numericAnchorTarget(target, window.location.hash);
      }
      if (y === undefined) return;
      restoring = true;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      ScrollTrigger.update();
      restoreFrame = window.requestAnimationFrame(() => { restoring = false; });
    }

    function installMedia() {
      media = gsap.matchMedia();
      media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)', tall: `(min-height: ${MIN_PIN_VIEWPORT_HEIGHT}px)` }, context => {
        const attributes = new Map<Element, Map<string, string | null>>();
        function attribute(target: Element, name: string, value: string | null) {
          let snapshot = attributes.get(target);
          if (!snapshot) { snapshot = new Map(); attributes.set(target, snapshot); }
          if (!snapshot.has(name)) snapshot.set(name, target.getAttribute(name));
          if (value === null) target.removeAttribute(name); else target.setAttribute(name, value);
        }
        function restoreAttributes(target: Element) {
          attributes.get(target)?.forEach((value, name) => { if (value === null) target.removeAttribute(name); else target.setAttribute(name, value); });
          attributes.delete(target);
        }
        // Register fail-open attribute cleanup before any GSAP setup can change the DOM.
        context.add(() => () => {
          for (const target of [...attributes.keys()]) restoreAttributes(target);
          triggers.clear();
        });
        triggers.clear();
        if (context.conditions?.reduced) { cancelAnchor(); return () => { triggers.clear(); }; }

        const scenePlans: ScenePlan[] = [];
        if (context.conditions?.tall) {
          // Write every candidate first, then read every measurement. Enhanced CSS keeps the tallest stage in its shared grid area.
          for (const section of Array.from(element.querySelectorAll<HTMLElement>('section[data-scene][data-pin]'))) {
            const name = section.dataset.scene || '';
            if (!['clypse', 'fomina', 'logic', 'process'].includes(name)) continue;
            const stages = name === 'logic'
              ? [0, 1, 2].map(index => section.querySelector<HTMLElement>(`[data-logic-part="${index}"]`)).filter((part): part is HTMLElement => !!part)
              : Array.from(section.querySelectorAll<HTMLElement>('[data-stage]')).filter(stage => stage.closest('[data-scene]') === section).sort((a, b) => Number(a.dataset.stage) - Number(b.dataset.stage));
            if (stages.length !== 3 || name !== 'logic' && stages.some((stage, index) => Number(stage.dataset.stage) !== index)) continue;
            const steps = Array.from(section.querySelectorAll<HTMLElement>('[data-step]'));
            let active = -1;
            const activate = (stageIndex: number) => {
              if (stageIndex === active) return;
              active = stageIndex;
              attribute(section, 'data-current', String(stageIndex));
              stages.forEach((stage, index) => {
                const selected = index === stageIndex;
                attribute(stage, 'data-active', String(selected));
                if (name !== 'logic') attribute(stage, 'aria-hidden', selected ? null : 'true');
              });
              steps.forEach(step => attribute(step, 'aria-current', Number(step.dataset.step) === stageIndex ? 'step' : null));
            };
            attribute(section, 'data-enhanced', 'true');
            activate(0);
            scenePlans.push({ section, name, stages, steps, activate });
          }
        }
        const viewportHeight = window.innerHeight;
        const measured = scenePlans.map(plan => ({ plan, height: plan.stages.some(stage => window.getComputedStyle(stage).display === 'none') ? Number.POSITIVE_INFINITY : Math.max(plan.section.scrollHeight, plan.section.getBoundingClientRect().height) }));
        const pinned = new Map<HTMLElement, gsap.core.Timeline>();
        for (const { plan, height } of measured) {
          if (!canPinScene({ viewportHeight, contentHeight: height, stages: plan.stages.length })) {
            [plan.section, ...plan.stages, ...plan.steps].forEach(restoreAttributes);
            continue;
          }
          const playhead = { progress: 0 };
          const timeline = gsap.timeline({ scrollTrigger: {
            trigger: plan.section, start: 'top top',
            end: () => `+=${pinScrollDistance(window.innerHeight, Number(plan.section.dataset.pin))}`,
            pin: true, pinSpacing: true, scrub: 0.35, invalidateOnRefresh: true,
            onRefresh: self => plan.activate(stageAtProgress(self.progress)),
          } });
          timeline.to(playhead, { progress: 1, duration: 1, ease: 'none', onUpdate: () => plan.activate(stageAtProgress(playhead.progress)) }, 0);
          // Keep every choreography inside this one-second timeline. Durations
          // are scroll proportions, and stage-link centres land on a calm frame.
          if (plan.name === 'logic') {
            const art = plan.stages[1];
            const cross = plan.stages[2];
            const result = plan.section.querySelector<HTMLElement>('[data-logic-result]');
            if (art) timeline.fromTo(art, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power1.out' }, 0.1);
            if (cross) timeline.fromTo(cross, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: 'power1.out' }, 0.5);
            if (result) timeline.fromTo(result, { y: 35, opacity: 0 }, { y: 0, opacity: 1, duration: 0.24, ease: 'power1.out' }, 0.56);
          } else {
            plan.stages.forEach((stage, index) => {
              const start = index / 3;
              const targets = plan.name === 'process'
                ? Array.from(stage.querySelectorAll<HTMLElement>(':scope > h3, :scope > p'))
                : Array.from(stage.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
              targets.forEach((target, targetIndex) => {
                const delay = plan.name === 'process' ? targetIndex * 0.018 : 0;
                // Screens fill the space between navigation and the scene's
                // lower edge. A small inward scale leaves annotations free
                // without crossing either boundary or adding scroll overflow.
                const process = plan.name === 'process';
                timeline.fromTo(target, { ...(process ? { y: 50 } : { scale: 0.94 }), opacity: process ? 0.55 : 0.25 }, { ...(process ? { y: 0 } : { scale: 1 }), opacity: 1, duration: 0.1, ease: 'power2.out' }, start + delay);
                if (index < 2) timeline.fromTo(target, { ...(process ? { y: 0 } : { scale: 1 }), opacity: 1 }, { ...(process ? { y: -25 } : { scale: 0.985 }), opacity: process ? 0.65 : 0.35, duration: 0.06, ease: 'power1.in', immediateRender: false }, start + 1 / 3 - 0.06);
              });
            });
          }
          const closingLine = plan.section.querySelector<HTMLElement>('[data-parallax-bottom]');
          if (closingLine) timeline.fromTo(closingLine, { opacity: 0.4, y: 12 }, { opacity: 1, y: 0, duration: 0.24, ease: 'none' }, 0.73);
          pinned.set(plan.section, timeline);
          if (timeline.scrollTrigger) triggers.set(plan.name, timeline.scrollTrigger);
        }

        // In flow layouts the story remains sequential. Animate inside each
        // article so its native fragment destination keeps stable geometry.
        for (const section of Array.from(element.querySelectorAll<HTMLElement>('section[data-scene]'))) {
          if (pinned.has(section)) continue;
          const stages = Array.from(section.querySelectorAll<HTMLElement>('[data-stage]')).filter(stage => stage.closest('[data-scene]') === section);
          for (const stage of stages) {
            const targets = section.dataset.scene === 'process'
              ? Array.from(stage.querySelectorAll<HTMLElement>(':scope > h3, :scope > p'))
              : Array.from(stage.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
            for (const target of targets) {
              const scaleX = Number(gsap.getProperty(target, 'scaleX'));
              const scaleY = Number(gsap.getProperty(target, 'scaleY'));
              gsap.fromTo(target, { scaleX: scaleX * 0.94, scaleY: scaleY * 0.94, opacity: 0.4 }, { scaleX, scaleY, opacity: 1, ease: 'none', scrollTrigger: { trigger: stage, start: 'top 94%', end: 'top 56%', scrub: 0.4 } });
            }
          }
          if (section.dataset.scene === 'logic') {
            for (const target of Array.from(section.querySelectorAll<HTMLElement>('[data-logic-part], [data-logic-result]'))) gsap.fromTo(target, { y: 24, opacity: 0.4 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: target, start: 'top 94%', end: 'top 60%', scrub: 0.4 } });
          }
        }

        // A single full-viewport paper surface owns every colour transition.
        // No independently tinted section edges or competing background tweens.
        const paper = '#f8f5ef';
        const chapters = [
          { target: element.querySelector<HTMLElement>('#fomina'), colour: '#e8d1c3' },
          { target: element.querySelector<HTMLElement>('#about'), colour: paper },
          { target: document.querySelector<HTMLElement>('[data-home-footer]'), colour: '#e9d1c4' },
        ].filter((chapter): chapter is { target: HTMLElement; colour: string } => !!chapter.target);
        let colourStops: { y: number; interpolate: (progress: number) => string }[] = [];
        gsap.set(document.body, { backgroundColor: paper });
        const setPaper = gsap.quickSetter(document.body, 'backgroundColor');
        function measureChapters() {
          let from = paper;
          colourStops = chapters.map(({ target, colour }) => {
            const scene = target.dataset.scene && triggers.get(target.dataset.scene);
            const stop = { y: scene ? scene.start : window.scrollY + target.getBoundingClientRect().top, interpolate: gsap.utils.interpolate(from, colour) };
            from = colour;
            return stop;
          });
        }
        function paintPaper(scrollY: number) {
          let colour = paper;
          for (const stop of colourStops) {
            const progress = chapterTransitionProgress(scrollY, stop.y, window.innerHeight);
            if (progress <= 0) break;
            colour = stop.interpolate(progress);
          }
          setPaper(colour);
        }
        measureChapters();
        ScrollTrigger.create({ start: 0, end: () => ScrollTrigger.maxScroll(window),
          onRefresh: self => { measureChapters(); paintPaper(self.scroll()); },
          onUpdate: self => paintPaper(self.scroll()),
        });

        const drawTargets = new Set(Array.from(element.querySelectorAll<SVGGeometryElement>('[data-draw], [data-draw] path, [data-draw] line, [data-draw] polyline')));
        for (const shape of drawTargets) {
          if (typeof shape.getTotalLength !== 'function') continue;
          let length = 0;
          try { length = shape.getTotalLength(); } catch { continue; }
          if (length <= 0) continue;
          // Non-scaling strokes express dash lengths in screen units, while
          // getTotalLength uses the SVG viewBox. Measure the projected curve
          // once so a wide/non-uniform viewBox cannot leave a visible tail.
          if (window.getComputedStyle(shape).vectorEffect === 'non-scaling-stroke') {
            const matrix = shape.getScreenCTM();
            if (matrix) {
              let projected = 0;
              let previous = shape.getPointAtLength(0).matrixTransform(matrix);
              for (let index = 1; index <= 80; index++) {
                const point = shape.getPointAtLength(length * index / 80).matrixTransform(matrix);
                projected += Math.hypot(point.x - previous.x, point.y - previous.y);
                previous = point;
              }
              length = projected;
            }
          }
          length = Math.ceil(length) + 1;
          const section = shape.closest<HTMLElement>('[data-scene]');
          const timeline = section ? pinned.get(section) : undefined;
          const from = { strokeDasharray: length, strokeDashoffset: length };
          if (timeline) timeline.fromTo(shape, from, { strokeDashoffset: 0, ease: 'none', duration: section?.dataset.scene === 'process' ? 0.42 : 0.65 }, section?.dataset.scene === 'logic' ? 0.1 : 0);
          else gsap.fromTo(shape, from, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: shape.closest('section') || shape, start: 'top 85%', end: shape.closest('[data-experience]') ? 'top top' : 'bottom 40%', scrub: 0.4 } });
        }

        for (const item of Array.from(element.querySelectorAll<HTMLElement>('[data-reveal]'))) {
          // Stage visibility belongs to the scene CSS; a reveal tween must never override a hidden stage.
          if (item.closest('[data-enhanced="true"], [data-stage]')) continue;
          if (revealed.has(item)) continue;
          gsap.fromTo(item, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out', onStart: () => { revealed.add(item); }, scrollTrigger: { trigger: item, start: 'top 94%', once: true } });
        }

        const heroTitle = element.querySelector<HTMLElement>('[data-hero-title]');
        const portrait = element.querySelector<HTMLElement>('[data-portrait]');
        const hero = heroTitle?.closest('section') || portrait?.closest('section');
        if (hero) {
          if (heroTitle) gsap.to(heroTitle, { yPercent: -10, opacity: 0.82, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.45 } });
          if (portrait) gsap.to(portrait, { y: -35, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.45 } });
        }
        for (const item of Array.from(element.querySelectorAll<HTMLElement>('[data-parallax]'))) {
          if (item.closest('[data-stage]')) continue;
          gsap.fromTo(item, { scale: 0.94, y: 24 }, { scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: item, start: 'top 95%', end: 'center 55%', scrub: 0.5 } });
        }
        for (const [selector, from, to] of [['[data-parallax-title]', 12, -20], ['[data-parallax-bottom]', 6, -9]] as const) {
          for (const item of Array.from(element.querySelectorAll<HTMLElement>(selector))) {
            const title = selector === '[data-parallax-title]';
            const section = item.closest<HTMLElement>('section');
            if (!title && section && pinned.has(section)) continue;
            gsap.fromTo(item, { y: from, opacity: title ? 0.5 : 0.4 }, { y: to, opacity: 1, ease: 'none', scrollTrigger: { trigger: title ? section || item : item, start: 'top 94%', end: title ? 'top 20%' : 'top 60%', scrub: 0.5 } });
          }
        }

        // The shared footer is outside the home ref. Only explicitly marked home targets opt in.
        for (const footer of Array.from(document.querySelectorAll<HTMLElement>('[data-home-footer]'))) {
          const targets = Array.from(footer.querySelectorAll<HTMLElement>('[data-footer-reveal]'));
          if (!targets.length) continue;
          // A transform would make the spread a containing block for its absolute children.
          gsap.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: footer, start: 'top 90%', end: 'clamp(top 55%)', scrub: 0.4 } });
        }

        for (const section of Array.from(element.querySelectorAll<HTMLElement>('[data-experience]'))) {
          const periods = Array.from(section.querySelectorAll<HTMLElement>('[data-period]'));
          let active = -1;
          const activate = (progress: number) => {
            const index = stageAtProgress(progress, 2);
            if (index === active) return;
            active = index; attribute(section, 'data-current', String(index));
            periods.forEach(period => attribute(period, 'data-active', String(Number(period.dataset.period) === index)));
          };
          activate(0);
          ScrollTrigger.create({ trigger: section, start: 'top 65%', end: 'bottom 45%', onUpdate: self => activate(self.progress), onRefresh: self => activate(self.progress) });
          periods.forEach((period, index) => gsap.fromTo(period, { y: 35, opacity: 0.55 }, { y: 0, opacity: 1, ease: 'power1.out', scrollTrigger: { trigger: period, start: index === 0 ? 'top 90%' : 'top 82%', end: 'top 64%', scrub: 0.4 } }));
          const divider = section.querySelector<HTMLElement>('[data-divider]');
          if (divider) gsap.fromTo(divider, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top 85%', end: 'center 55%', scrub: 0.4 } });
        }
      }, element);
    }

    function refresh() {
      if (disposed) return;
      ScrollTrigger.refresh();
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(restoreInitialPosition);
    }
    function rebuild() {
      if (disposed) return;
      // Flow positions are sampled immediately before measurement. A font or
      // image callback may have queued this rebuild before a native anchor or
      // another scroll; restoring its old Y would undo that newer navigation.
      const previousY = window.scrollY;
      const previous = rebuildPosition?.scene;
      rebuildPosition = null;
      rebuildTimer = undefined;
      media?.revert(); installMedia(); refresh();
      if (previous && !pendingAnchor) {
        const replacement = triggers.get(previous.name);
        if (replacement) window.scrollTo({ top: replacement.start + (replacement.end - replacement.start) * previous.progress, behavior: 'instant' });
        else {
          const stage = element!.querySelector<HTMLElement>(`[data-scene="${previous.name}"] [data-stage="${stageAtProgress(previous.progress)}"]`);
          if (stage) window.scrollTo({ top: window.scrollY + stage.getBoundingClientRect().top, behavior: 'instant' });
        }
      }
      // Measuring an overflowing flow scene briefly collapses its three stages
      // into one grid area. Restore any scroll offset the browser clamped then.
      if (!previous && !pendingAnchor) window.scrollTo({ top: previousY, behavior: 'instant' });
      ScrollTrigger.update();
    }
    function requestRebuild() {
      // Reduced motion has no pins or measured animation state to rebuild.
      // Native fragment navigation must remain entirely browser-owned.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // Capture before ScrollTrigger's debounced resize refresh changes the
      // numeric pin ranges. Reading progress in rebuild() can select a new stage.
      if (!rebuildPosition) {
        const active = [...triggers.entries()].find(([, trigger]) => trigger.isActive);
        rebuildPosition = { y: window.scrollY, scene: active ? { name: active[0], progress: active[1].progress } : null };
      }
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(rebuild, 180);
    }

    function onAnchor(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname !== path || !destination.hash) { cancelAnchor(); persistPosition(); return; }
      let id = '';
      try { id = decodeURIComponent(destination.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target || !element.contains(target) && !element.contains(anchor)) return;
      // A deliberate click supersedes a scheduled initial history/hash restoration,
      // including native fragment navigation in the reduced-motion and flow layouts.
      restored = true; restoring = false;
      rebuildPosition = null;
      window.cancelAnimationFrame(restoreFrame);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const stage = parseStageHash(destination.hash);
      // Keep the native flow destination, but retain it while lazy images or fonts
      // rebuild the pins: that refresh can otherwise move the page away from it.
      if (stage && !triggers.has(stage.scene)) { pendingAnchor = destination.hash; return; }
      ScrollTrigger.refresh();
      const top = numericAnchorTarget(target, destination.hash);
      event.preventDefault();
      persistPosition();
      pendingAnchor = destination.hash;
      window.history.pushState(window.history.state, '', destination.hash);
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    function onPopState() {
      if (window.location.pathname !== path) return;
      cancelAnchor();
      rebuildPosition = null;
      restored = true; restoring = false;
      window.cancelAnimationFrame(restoreFrame);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const remembered = rememberedPosition();
        if (remembered) { window.scrollTo({ top: remembered.y, behavior: 'instant' }); ScrollTrigger.update(); }
      });
    }

    ScrollTrigger.addEventListener('refresh', onRefresh);
    installMedia(); refresh();
    // Keep the one-time entrance separate from responsive scene rebuilding.
    const entrance = gsap.matchMedia();
    entrance.add('(prefers-reduced-motion: no-preference)', () => {
      if (window.scrollY > window.innerHeight / 2 || window.location.hash) return;
      const lines = Array.from(element.querySelectorAll<HTMLElement>('[data-hero-title] > span'));
      const details = Array.from(element.querySelectorAll<HTMLElement>('[data-hero-detail]'));
      if (lines.length) gsap.fromTo(lines, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' });
      if (details.length) gsap.fromTo(details, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55, delay: 0.1, ease: 'power2.out' });
    }, element);
    const sizes = new Map<Element, { width: number; height: number }>();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      let changed = false;
      for (const entry of entries) {
        const previous = sizes.get(entry.target);
        const next = { width: entry.contentRect.width, height: entry.contentRect.height };
        if (previous && (Math.abs(previous.width - next.width) > 1 || Math.abs(previous.height - next.height) > 1)) changed = true;
        sizes.set(entry.target, next);
      }
      if (changed) requestRebuild();
    });
    observer?.observe(element);
    element.querySelectorAll<HTMLElement>('[data-stage]').forEach(stage => observer?.observe(stage));
    const images = Array.from(element.querySelectorAll('img'));
    images.forEach(image => { if (!image.complete) { image.addEventListener('load', requestRebuild); image.addEventListener('error', requestRebuild); } });
    void document.fonts?.ready.then(() => { if (!disposed) requestRebuild(); });
    document.addEventListener('click', onAnchor);
    window.addEventListener('resize', requestRebuild, { passive: true });
    window.addEventListener('pagehide', persistPosition);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('wheel', onNavigationInput, { passive: true });
    window.addEventListener('touchstart', onNavigationInput, { passive: true });
    window.addEventListener('keydown', onNavigationKey);
    ScrollTrigger.addEventListener('scrollEnd', onScrollEnd);
    return () => {
      persistPosition(); disposed = true;
      if (rebuildTimer) clearTimeout(rebuildTimer);
      window.cancelAnimationFrame(frame); window.cancelAnimationFrame(restoreFrame); cancelAnchor();
      observer?.disconnect(); media?.revert(); entrance.revert();
      images.forEach(image => { image.removeEventListener('load', requestRebuild); image.removeEventListener('error', requestRebuild); });
      document.removeEventListener('click', onAnchor);
      window.removeEventListener('resize', requestRebuild);
      window.removeEventListener('pagehide', persistPosition);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('wheel', onNavigationInput);
      window.removeEventListener('touchstart', onNavigationInput);
      window.removeEventListener('keydown', onNavigationKey);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      ScrollTrigger.removeEventListener('scrollEnd', onScrollEnd);
    };
  }, { scope: root, dependencies: [locale], revertOnUpdate: true });
}
