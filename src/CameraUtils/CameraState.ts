import { Vector3, Quaternion, Nullable, Observer, Scene, FreeCamera, ArcRotateCamera, ISize, Camera, Scalar, BoundingSphere, Ray, Engine } from '@babylonjs/core';
import { ArcRotateCameraState } from './ArcRotateCameraState';
import { setActiveCamera, orbitCameraFov, freeCameraFov, onChangeToOrbitMode, onChangeToFreeMode, freeCameraMinZ, orbitCameraMinZ } from './cameraUtils';
import { FreeCameraState } from './FreeCameraState';

export abstract class CameraState {
    public abstract position: Vector3;
    public abstract pseudoOrthogonalPosition?: Vector3;
    public abstract target: Vector3;
    public abstract fov: number;
    public abstract radius: number;
    public viewToWorldScale?: number;
    public orthogonalMinZ?: number;

    // public associatedViewpoint?: Viewpoint;
    protected viewWorldSize: Nullable<ISize> = { width: 0, height: 0 };

    public abstract getQuaternion(): Quaternion;
    public abstract clone(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): CameraState;
    // public abstract fromViewpoint(viewpoint: Viewpoint): void;
    // public abstract toViewpoint(index?: number): Viewpoint;
    public abstract fromCameraState(cameraState: CameraState, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void;
    // protected abstract fillViewpoint(viewpoint: Viewpoint): Viewpoint;

    public static elapsedLerpTime: number = 0;
    public static readonly interpolationDuration: number = 2;
    public static interpolationObserver: Nullable<Observer<Scene>> = null;

    public static lastArcRotateState?: ArcRotateCameraState;
    public static lastFreeState?: FreeCameraState;
    public static scratchArcRotateState: ArcRotateCameraState;
    public static scratchFreeState: FreeCameraState;

    public static readonly sceneBoundsSphere: BoundingSphere;
    public static readonly pseudoOrthogonalDistanceMultiplier: number = 0;

    protected abstract interpolate(target: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void;
    public abstract interpolateToState(target: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string>;

    public abstract getClassName(): string;

    protected constructor(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera) {
        if (CameraState.pseudoOrthogonalDistanceMultiplier === 0) {
            const extents = mainScene.getWorldExtends();
            // @ts-ignore
            CameraState.sceneBoundsSphere = new BoundingSphere(extents.min, extents.max);
            // @ts-ignore
            CameraState.pseudoOrthogonalDistanceMultiplier = (CameraState.sceneBoundsSphere.radiusWorld * 2) * 10;

            orbitCamera.onViewMatrixChangedObservable.add(() => { this.fixPseudoOrthoClipping(orbitCamera); });
            freeCamera.onViewMatrixChangedObservable.add(() => { this.fixPseudoOrthoClipping(freeCamera); });
        }
    }

    private fixPseudoOrthoClipping(camera: Camera) {
        if (camera.pseudoOrthogonalPosition) {
            camera.minZ = Vector3.Distance(camera.position, CameraState.sceneBoundsSphere.centerWorld) - CameraState.sceneBoundsSphere.radiusWorld;
        }
    }

    public setupWorldSize() {
        //if (!this.associatedViewpoint) {

            const screenAspect = window.innerWidth / window.innerHeight;

            this.viewWorldSize = { width: 0, height: 0 };

            if (this.viewToWorldScale !== undefined) {
                if (screenAspect > 1) {
                    this.viewWorldSize.height = this.viewToWorldScale * screenAspect;
                    this.viewWorldSize.width = this.viewWorldSize.height * screenAspect;
                } else {
                    this.viewWorldSize.width = this.viewToWorldScale / screenAspect;
                    this.viewWorldSize.height = this.viewWorldSize.width / screenAspect;
                }
            } else {
                this.viewWorldSize.width = (Math.tan(this.fov / 2) * Vector3.Distance(this.position, this.target)) * 2;
                this.viewWorldSize.height = this.viewWorldSize.width / screenAspect;
            }
        //}
    }

    protected interpolateWorldSnapshotSize(lerpTarget: CameraState, lerpTime: number): Nullable<ISize> {

        if (this.viewWorldSize && lerpTarget.viewWorldSize) {
            const lerpSize: ISize = { width: 0, height: 0 };

            lerpSize.width = Scalar.Lerp(this.viewWorldSize.width, lerpTarget.viewWorldSize.width, lerpTime);
            lerpSize.height = Scalar.Lerp(this.viewWorldSize.height, lerpTarget.viewWorldSize.height, lerpTime);

            return lerpSize;

        }
        return null;
    }

    // TODO: Set screen aspect as static field in WindowResponsiveness.ts instead
    protected calculateFovFromScreenAspect(camera: Camera, adjacent: number, worldSize: ISize): void {

        const snapshotAspect = worldSize.width / worldSize.height;
        const snapshotScreenHeight = window.innerWidth / snapshotAspect;
        const screenAspect = window.innerWidth / window.innerHeight;

        const opposite = (snapshotScreenHeight > window.innerHeight) ? worldSize.height * screenAspect * 0.5 : worldSize.width * 0.5;

        camera.fov = (Math.atan2(opposite, adjacent) * 2);
    }

    public setupInterpolationObserver(lerpTarget: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string> {

        return new Promise<string>((resolve, reject) => {

            if (!CameraState.interpolationObserver) CameraState.interpolationObserver = mainScene.onBeforeRenderObservable.add(() => { this.interpolate(lerpTarget, engine, mainScene, orbitCamera, freeCamera); });

            CameraState.interpolationObserver!.interpolationResolved = () => resolve('True');
            CameraState.interpolationObserver!.interpolationInterrupted = () => reject(`Interpolation has been interrupted`);
        });
    }

    /*public static async fromViewpoint(viewpoint: Viewpoint): Promise<ArcRotateCameraState | FreeCameraState> {

        if (viewpoint.perspectiveCamera && viewpoint.cameraType === CAMERA_TYPE.FirstPerson) {
            const cameraState = new FreeCameraState();
            await cameraState.fromViewpoint(viewpoint).catch((err) => { console.error(err); });
            return cameraState;
        } else {
            const cameraState = new ArcRotateCameraState();
            await cameraState.fromViewpoint(viewpoint).catch((err) => { console.error(err); });
            return cameraState;
        }
    }*/

    private resetCameras(orbitCamera: ArcRotateCamera, freeCamera: FreeCamera) {
        if (orbitCamera.pseudoOrthogonalPosition) orbitCamera.minZ = orbitCameraMinZ;
        if (freeCamera.pseudoOrthogonalPosition) freeCamera.minZ = freeCameraMinZ;

        orbitCamera.pseudoOrthogonalPosition = undefined;
        freeCamera.pseudoOrthogonalPosition = undefined;

        orbitCamera.realStatePosition = undefined;
        freeCamera.realStatePosition = undefined;
    }

    public static resetFov(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void {
        const fov = mainScene.activeCamera?.getClassName() === 'FreeCamera' ? freeCameraFov : orbitCameraFov;
        CameraState.interpolateTo({ fov }, mainScene, orbitCamera, freeCamera).catch((err) => { console.log(err); });
    }

    public static interpolateTo(target: CameraTarget, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string> {
        const cam = mainScene.activeCamera;
        return (cam as any)?.getCameraState ? (cam! as FreeCamera | ArcRotateCamera).getCameraState(mainScene, orbitCamera, freeCamera).interpolateTo(target, mainScene, orbitCamera, freeCamera) : Promise.reject(`Scene active camera has no CameraState functions for interpolation`);
    }

    public interpolateTo(target: CameraTarget, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, debugging?: boolean): Promise<string> {

        CameraState.scratchArcRotateState = new ArcRotateCameraState(mainScene, orbitCamera, freeCamera);
        CameraState.scratchFreeState = new FreeCameraState(mainScene, orbitCamera, freeCamera);

        CameraState.elapsedLerpTime = 0;

        orbitCamera.minZ = orbitCameraMinZ;
        freeCamera.minZ = freeCameraMinZ;

        if (CameraState.interpolationObserver) {
            CameraState.interpolationObserver.interpolationInterrupted();
            this.resolveInterpolation(mainScene);
        }

        let targetState: CameraState;
        if (target.fov !== undefined) {

            const sceneCamera = (mainScene.activeCamera as FreeCamera | ArcRotateCamera);
            targetState = sceneCamera?.getCameraState(mainScene, orbitCamera, freeCamera);
            if (sceneCamera?.pseudoOrthogonalPosition && sceneCamera?.realStatePosition) {
                targetState.position = sceneCamera?.realStatePosition;

                this.setupConformalDollyZoomPosition(sceneCamera, targetState);

                targetState.radius = Vector3.Distance(targetState.target, targetState.position);
            }
            if (sceneCamera?.pseudoOrthogonalPosition) {
                this.resetCameras(orbitCamera, freeCamera);
            }

            targetState.fov = target.fov;
        } else if (target.position) {
            targetState = (mainScene.activeCamera! as FreeCamera | ArcRotateCamera)?.getCameraState(mainScene, orbitCamera, freeCamera);
            targetState.position = target.position;

            const direction = Vector3.Forward().rotateDirectionByQuaternion(this.getQuaternion());
            targetState.target = targetState.position.clone().addInPlace(direction.scaleInPlace(FreeCameraState.virtualTargetDistance));

        } else if (target.cameraState) {
            targetState = target.cameraState;
        } else {
            return Promise.reject(`No interpolation target given`);
        }

        this.setupWorldSize();
        targetState.setupWorldSize();

        if (debugging) {
            //targetState.debugCameraState();
        }

        return this.interpolateToState(targetState, mainScene.getEngine(), mainScene, orbitCamera, freeCamera);
    }

    protected setupConformalDollyZoomPosition(camera: Camera, targetState: CameraState): void {

        const opposite = window.innerWidth / 2;
        const adjacent = Math.tan(camera.fov / 2) / opposite;

        const cameraForward = camera.getDirection(Vector3.Forward());
        const cameraBackward = camera.getDirection(Vector3.Backward());

        const conformalDollyZoomPosition = targetState.target.add(cameraBackward).scale(adjacent);

        const conformalRay = new Ray(conformalDollyZoomPosition, cameraForward);

        const conformalSignedDistance = conformalRay.signedDistanceToSphereSurface(CameraState.sceneBoundsSphere);

        const conformalPositionInsideSceneBounds = (!!conformalSignedDistance && conformalSignedDistance < 0);

        if (conformalPositionInsideSceneBounds) {
            conformalDollyZoomPosition.addInPlace(cameraForward.scale(conformalSignedDistance!));
        }

        targetState.position = conformalDollyZoomPosition;
    }

    protected setupPseudoOrthogonalPositionToCamera(camera: Camera, targetState: CameraState): void {
        camera.pseudoOrthogonalPosition = this.pseudoOrthogonalPosition ? this.pseudoOrthogonalPosition : targetState.pseudoOrthogonalPosition;
        const realOrthogonalPosition = this.pseudoOrthogonalPosition ? this.position.clone() : targetState.position.clone();
        camera.realStatePosition = camera.pseudoOrthogonalPosition ? realOrthogonalPosition : undefined;
    }

    protected endInterpolate(lerpTarget: CameraState, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void {

        if (!lerpTarget.pseudoOrthogonalPosition) {
            this.resetCameras(orbitCamera, freeCamera);
        }

        CameraState.lastFreeState = undefined;
        CameraState.lastArcRotateState = undefined;
        CameraState.scratchArcRotateState = new ArcRotateCameraState(mainScene, orbitCamera, freeCamera);
        CameraState.scratchFreeState = new FreeCameraState(mainScene, orbitCamera, freeCamera);
        this.fromCameraState(lerpTarget, mainScene, orbitCamera, freeCamera);

        if (lerpTarget instanceof ArcRotateCameraState) {
            onChangeToOrbitMode.next();
            setActiveCamera(orbitCamera, mainScene);
        } else {
            onChangeToFreeMode.next();
            setActiveCamera(freeCamera, mainScene);
        }

        this.resolveInterpolation(mainScene);
    }

    protected resolveInterpolation(mainScene: Scene) {
        if (CameraState.interpolationObserver) {
            mainScene.onBeforeRenderObservable.remove(CameraState.interpolationObserver);
            CameraState.interpolationObserver.interpolationResolved();
            CameraState.interpolationObserver = null;
        }
    }

    protected interruptInterpolation(mainScene: Scene) {
        if (CameraState.interpolationObserver) {
            mainScene.onBeforeRenderObservable.remove(CameraState.interpolationObserver);
            CameraState.interpolationObserver.interpolationInterrupted();
            CameraState.interpolationObserver = null;
        }
    }

    //TODO: fix this in NPM package
    /*public debugCameraState(): void {

        if (this.viewWorldSize) {
            if (this.associatedViewpoint) {
                ViewpointDebugger.getInstance().debugSnapshot(this.associatedViewpoint).catch((err) => { console.error(err); });
            }

            const cameraType: CAMERA_TYPE = this.getClassName() === 'ArcRotateCamera' ? CAMERA_TYPE.Orbit : CAMERA_TYPE.FirstPerson;
            ViewpointDebugger.getInstance().debugCameraFrustum(this.viewWorldSize, cameraType, this.position, this.target);
        }
    }*/
}

declare module '@babylonjs/core/Cameras/camera.js' {
    interface Camera {
        pseudoOrthogonalPosition?: Vector3;
        realStatePosition?: Vector3;
    }
}

declare module '@babylonjs/core/Misc/observable.js' {
    interface Observer<T> {
        interpolationResolved: () => void;
        interpolationInterrupted: () => void;
    }
}

export interface CameraTarget {
    fov?: number;
    position?: Vector3;
    cameraState?: CameraState;
}
