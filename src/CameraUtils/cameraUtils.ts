import { Subject } from 'rxjs';
import { Scene, Vector3, ArcRotateCamera, FreeCamera, Camera, Nullable, Quaternion, ActionManager, ExecuteCodeAction } from '@babylonjs/core';
import { DeviceInfo } from '../deviceInfo';
import { FreeCameraState } from './FreeCameraState';
import { ArcRotateCameraState } from './ArcRotateCameraState';

import { onStartedPinch, onEndedPinch, onPinch } from '../touchUtils';

// TODO: Change to CameraController Class
let cameraHasMoved: boolean = false;
let cameraStartedMoving: boolean = false;
const pinchMultiplier: number = 0.01;

const freeCameraSpeed = 0.1;
const runMultiplier = 10;

export const freeCameraFov: number = 1.75;
export const orbitCameraFov: number = 1.75;

export const freeCameraMinZ: number = 0.1;
export const freeCameraMaxZ: number = 10000.0;

export const orbitCameraMinZ: number = 0.1;
export const orbitCameraMaxZ: number = 10000.0;

let defaultLowerRadiusLimit: Nullable<number> = null;

// TODO: Make below fields static of CameraController Class
export let freeCamera: FreeCamera;
export let orbitCamera: ArcRotateCamera;
export let cameraIsCurrentlyMoving: boolean = false;

/** Set Camera active or not active, stop moving and screen move */
export const setActiveCameraActive: Subject<boolean> = new Subject<boolean>();
export const onAfterCameraStartedMoving: Subject<void> = new Subject<void>();
export const onAfterCameraHasMoved: Subject<void> = new Subject<void>();
export const onAfterCameraStoppedMoving: Subject<void> = new Subject<void>();
export const onChangeToOrbitMode: Subject<void> = new Subject<void>();
export const onChangeToFreeMode: Subject<void> = new Subject<void>();

function initialize(mainScene: Scene) {
  setActiveCameraActive.subscribe((value) => {
    if (value) {
      mainScene!.activeCamera?.attachControl(true);
    } else {
      mainScene!.activeCamera?.detachControl();
    }
  });

  mainScene.onAfterRenderObservable.add(() => {
    if (cameraStartedMoving && !cameraHasMoved) {
      cameraStartedMoving = false;
      cameraIsCurrentlyMoving = false;
      onAfterCameraStoppedMoving.next();
    }
    cameraHasMoved = false;
  });
}

export function setDefaultCameraSettings(mainScene: Scene): void {
  initialize(mainScene);
  freeCamera.position = orbitCamera.position;
  freeCamera.rotationQuaternion = Quaternion.Identity(); // Force creation of quaternion
  freeCamera.setTarget(Vector3.Zero());
}

const cameraMovedEventParser = () => {
  if (!cameraStartedMoving) { cameraStartedMoving = true; onAfterCameraStartedMoving.next(); cameraIsCurrentlyMoving = true; }
  onAfterCameraHasMoved.next();
  cameraHasMoved = true;
};

export function createOrbitCamera(targetScene: Scene) {
  const camera = new ArcRotateCamera('ArcRotateCamera', 0, -Math.HALF_PI, 0, Vector3.Zero(), targetScene, true);
  camera.minZ = orbitCameraMinZ;
  camera.maxZ = orbitCameraMaxZ;
  camera.lowerRadiusLimit = 1;
  camera.inertia = 0.4;
  camera.angularSensibilityY = 550;
  camera.angularSensibilityX = 550;
  camera.panningInertia = 0.4;
  camera.fov = orbitCameraFov;
  camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
  camera.panningSensibility = DeviceInfo.isMobileOrTablet ? 30 : 80;
  camera.inverseRotationSpeed = 500;
  camera.wheelDeltaPercentage = DeviceInfo.browser === 'firefox' ? 0.001 : 0.033;
  camera.onViewMatrixChangedObservable.add(cameraMovedEventParser);

  // speed up camera panning when orbit camera is far away
  const cameraDistanceFromTarget = 150;
  targetScene.onAfterRenderObservable.add(() => {
    if (camera.radius >= cameraDistanceFromTarget) {
      camera.panningSensibility = DeviceInfo.isMobileOrTablet ? 5 : 10;
    } else {
      camera.panningSensibility = DeviceInfo.isMobileOrTablet ? 30 : 80;
    }
  });

  return orbitCamera = camera;
}

function toCharCode(value: string): number {
  return value.toUpperCase().charCodeAt(0);
}

export function createFreeCamera(targetScene: Scene): FreeCamera {
  const position: Vector3 = new Vector3(0, 1.4, -30);
  const camera = new FreeCamera('FreeCamera', position, targetScene, true);
  camera.speed = freeCameraSpeed;
  camera.minZ = freeCameraMinZ;
  camera.maxZ = freeCameraMaxZ;
  camera.fov = freeCameraFov;
  camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
  camera.inertia = 0.4;
  camera.angularSensibility = 550;
  camera.keysUp.push(toCharCode('w'));
  camera.keysLeft.push(toCharCode('a'));
  camera.keysDown.push(toCharCode('s'));
  camera.keysRight.push(toCharCode('d'));
  camera.keysUpward.push(toCharCode('e'));
  camera.keysDownward.push(toCharCode('q'));

  registerRun(targetScene);

  camera.onViewMatrixChangedObservable.add(cameraMovedEventParser);

  registerPinching(targetScene);

  return freeCamera = camera;
}

function registerPinching(mainScene: Scene) {


  onStartedPinch.subscribe(() => {
    if (mainScene.activeCamera instanceof FreeCamera) {
      mainScene.activeCamera?.detachControl();
    }
  });
  onEndedPinch.subscribe(() => {
    if (mainScene.activeCamera instanceof FreeCamera) {
      mainScene.activeCamera?.attachControl(true);
    }
  });

  onPinch.subscribe((delta: any) => {
    if (mainScene.activeCamera instanceof FreeCamera) {
      const camera = mainScene.activeCamera! as FreeCamera;
      const dirX = Math.sin(camera.rotation.y);
      const dirZ = Math.cos(camera.rotation.y);

      camera.position.x += dirX * delta * pinchMultiplier;
      camera.position.z += dirZ * delta * pinchMultiplier;
    }
  });
}

export function setOrbitCameraRadius(value: boolean, mainScene: Scene) {
  if (defaultLowerRadiusLimit == null) defaultLowerRadiusLimit = orbitCamera.lowerRadiusLimit;
  mainScene.collisionsEnabled = value;
  orbitCamera.lowerRadiusLimit = value ? defaultLowerRadiusLimit : 1;
}

export function changeToFreeMode(targetPosition: Vector3, mainScene: Scene): void {

  if (mainScene.activeCamera instanceof ArcRotateCamera) {

    const cam = mainScene.activeCamera;
    let position = new Vector3(Math.cos(cam.alpha + Math.PI), 0, Math.sin(cam.alpha + Math.PI));

    const distance = FreeCameraState.virtualTargetDistance;
    position = position.multiplyByFloats(distance, distance, distance);

    const freeCameraState: FreeCameraState = freeCamera.getCameraState();

    freeCameraState.position = targetPosition.clone();
    freeCameraState.target = targetPosition.clone().add(position);
    freeCameraState.fov = freeCameraFov;
    onChangeToFreeMode.next();

    mainScene.activeCamera!.interpolateTo({ cameraState: freeCameraState }).catch(() => { });
  }
}

export function setActiveCamera(camera: Camera, scene: Scene): void {
  if (scene.activeCamera === camera) return;
  if (scene.activeCamera) scene.activeCamera.detachControl();
  scene.activeCamera = camera;
  scene.activeCamera.attachControl(true);
}


//TODO: create more generic set for other cameras
//TODO: change navigationTool
export function setSharedCameraPosition(scene: Scene, orbitCamera: ArcRotateCamera, freeCam: FreeCamera, navigationTool: any, sharedCameraPosition: SharedCameraInfo): void {
  if (sharedCameraPosition) {
    const newPosition = sharedCameraPosition.position;
    const newTarget = sharedCameraPosition.target;
    if (sharedCameraPosition.fp) {
      freeCam.position = newPosition;
      freeCam.setTarget(newTarget);
      setActiveCamera(freeCam, scene);
      navigationTool?.enable();
      onChangeToFreeMode.next();
    } else {
      orbitCamera.position = newPosition;
      orbitCamera.setTarget(newTarget);
      setActiveCamera(orbitCamera, scene);
    }
  }
}

interface SharedCameraInfo { 
  fp: boolean,
  position: Vector3,
  target: Vector3
}

function registerRun(mainScene: Scene): void {
  if (!mainScene.actionManager) { mainScene.actionManager = new ActionManager(mainScene); }
  mainScene.actionManager.registerAction(
    new ExecuteCodeAction({
      trigger: ActionManager.OnKeyDownTrigger,
    }, e => {
      if ((e.sourceEvent.key === 'Shift')) {
        freeCamera.speed = freeCameraSpeed * runMultiplier;
      }
    }),
  );
  mainScene.actionManager.registerAction(
    new ExecuteCodeAction({
      trigger: ActionManager.OnKeyUpTrigger,
    }, e => {
      if ((e.sourceEvent.key === 'Shift')) {
        freeCamera.speed = freeCameraSpeed;
      }
    }),
  );
}
