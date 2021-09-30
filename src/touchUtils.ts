import { PointerEventTypes, PointerInfo, Scene } from '@babylonjs/core';
import { Subject } from 'rxjs';

let isPointerDown = false;
let previousTouchDistance: number = 0;

export let pinchActive: boolean = false;

export let onStartedPinch: Subject<void> = new Subject<void>();
export let onPinch: Subject<number> = new Subject<number>();
export let onEndedPinch: Subject<void> = new Subject<void>();
export let onPointerDown: Subject<void> = new Subject<void>();
export let onPointerUp: Subject<void> = new Subject<void>();
export let onCursorDragged: Subject<void> = new Subject<void>();
export let onTapped: Subject<void> = new Subject<void>();
export let onCursorMoved: Subject<void> = new Subject<void>();

export function initializeTouches(mainScene: Scene, canvas: HTMLCanvasElement) {

  handleTouchEvents(canvas);

  mainScene.onPointerObservable.add(p => HandlePointerEvent(p));
}

function HandlePointerEvent(pointerInfo: PointerInfo) {

  const pointerHandlers: Array<{ eventType: PointerEventTypes, handler: (pointerInfo: PointerInfo) => void }> = [
    {
      eventType: PointerEventTypes.POINTERDOWN, handler: p => {
        isPointerDown = true;
        onPointerDown.next();
      },
    },
    {
      eventType: PointerEventTypes.POINTERUP, handler: p => {
        isPointerDown = false;
        onPointerUp.next();
      },
    },
    { eventType: PointerEventTypes.POINTERTAP, handler: p => onTapped.next() },
    {
      eventType: PointerEventTypes.POINTERMOVE, handler: p => {
        isPointerDown ? onCursorDragged.next() : onCursorMoved.next();
      },
    },
  ];
  pointerHandlers
    .filter(x => x.eventType === pointerInfo.type) // TODO: Check if touch is available through here
    .forEach(x => x.handler(pointerInfo));
}

function handleTouchEvents(canvas: HTMLCanvasElement) {

  canvas.addEventListener('touchstart', touchStart);
  canvas.addEventListener('touchend', touchEnd);
  canvas.addEventListener('touchcancel', touchEnd);
  canvas.addEventListener('touchmove', touchMove);

  function touchStart(e: TouchEvent) {
    previousTouchDistance = distanceFromTouches(e.touches);
  }
  function touchEnd(e: TouchEvent) {

    if (e.touches.length <= 1) {
      if (pinchActive) {
        pinchActive = false;
        onEndedPinch.next();
      }
    }

    previousTouchDistance = distanceFromTouches(e.touches);
  }
  function touchMove(e: TouchEvent) {
    if (e.touches.length >= 2) {
      const currentDistance = distanceFromTouches(e.touches);
      const touchDelta = currentDistance - previousTouchDistance;
      if (!pinchActive) {
        pinchActive = true;
        onStartedPinch.next();
      }
      previousTouchDistance = currentDistance;
      onPinch.next(touchDelta);
    }
  }
}

function distanceFromTouches(touches: TouchList): number {
  let totalDistance = 0;
  if (touches.length >= 2) {
    for (let i = 1; i < touches.length; i++) {
      const x = touches.item(i)!.screenX - touches.item(i - 1)!.screenX;
      const y = touches.item(i)!.screenY - touches.item(i - 1)!.screenY;
      totalDistance += Math.sqrt((x * x) + (y * y));
    }
  }
  return totalDistance;
}
