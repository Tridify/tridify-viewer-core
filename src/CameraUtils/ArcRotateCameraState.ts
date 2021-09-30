import { ArcRotateCamera, Quaternion, Vector3, Scalar, FreeCamera, Scene, Engine } from '@babylonjs/core';
import { FreeCameraState } from './FreeCameraState';
import { CameraState, CameraTarget } from './CameraState';
import { setActiveCamera, orbitCameraFov, onChangeToFreeMode, onAfterCameraHasMoved } from './cameraUtils';
// import { Viewpoint, PerspectiveCamera } from '@/tools/CommentingTool/Viewpoint';
import { v4 as uuidV4 } from 'uuid';
import { normalizeAngle, easeIn, easeOut, easeInQuint, easeOutQuint } from '../mathHelper';
export class ArcRotateCameraState extends CameraState {

    public alpha: number = 0;
    public beta: number = 0;
    public radius: number = 0;
    public fov: number = 0;
    public position: Vector3 = Vector3.Zero();
    public target: Vector3 = Vector3.Zero();

    public pseudoOrthogonalPosition?: Vector3;

    public constructor(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, cameraState?: CameraState) {
        super(mainScene, orbitCamera, freeCamera);
        if (cameraState) this.fromCameraState(cameraState, mainScene, orbitCamera, freeCamera);
    }

    public getClassName(): string {
        return 'ArcRotateCameraState';
    }

    public fromCameraState(cameraState: CameraState, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void {

        this.position = cameraState.position.clone();
        this.target = cameraState.target.clone();
        this.fov = cameraState.fov;
        this.setupFromTargetPosition();
        this.setupWorldSize();
    }

    /*public async fromViewpoint(viewpoint: Viewpoint): Promise<any> {

        let position = viewpoint.perspectiveCamera ? viewpoint.perspectiveCamera.cameraViewPoint : viewpoint.orthogonalCamera?.cameraViewPoint;
        position = position ? position : Vector3.Zero();
        this.position = position;
        this.target = viewpoint.target;
        this.fov = viewpoint.perspectiveCamera ? viewpoint.perspectiveCamera.fieldOfView : orbitCameraFov;
        this.viewToWorldScale = viewpoint.orthogonalCamera?.viewToWorldScale;

        this.setupFromTargetPosition();
        if (this.viewToWorldScale) {

            const viewDirection = viewpoint.perspectiveCamera?.cameraDirection ? viewpoint.perspectiveCamera!.cameraDirection! : viewpoint.orthogonalCamera!.cameraDirection!;
            this.pseudoOrthogonalPosition = this.position.add(viewDirection.scale(CameraState.pseudoOrthogonalDistanceMultiplier));
            this.radius = Vector3.Distance(this.pseudoOrthogonalPosition, this.target);
        }

        this.associatedViewpoint = viewpoint;

        this.viewWorldSize = await viewpoint.getWorldSnapshotSize();

        return Promise.resolve();
    }

    public toViewpoint(index?: number): Viewpoint {

        const viewpoint = this.fillViewpoint(new Viewpoint());
        viewpoint.guid = uuidV4();
        viewpoint.index = index ? index : null;
        return viewpoint;
    }

    public fillViewpoint(viewpoint: Viewpoint): Viewpoint {

        const quaternion = this.getQuaternion();
        const forward = quaternion.rotateDirection(Vector3.Forward());
        const up = quaternion.rotateDirection(Vector3.Up());

        const perspectiveCamera = new PerspectiveCamera();
        perspectiveCamera.cameraViewPoint = this.position;
        perspectiveCamera.cameraDirection = forward;
        perspectiveCamera.cameraUpVector = up;
        perspectiveCamera.fieldOfView = this.fov;

        viewpoint.perspectiveCamera = perspectiveCamera;
        viewpoint.cameraType = CAMERA_TYPE.Orbit;
        viewpoint.target = this.target;

        this.associatedViewpoint = viewpoint;
        viewpoint.getWorldSnapshotSize().then(size => {
            this.viewWorldSize = size;
        }).catch((err) => { console.error(err); });

        return viewpoint;
    }*/

    public clone(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): ArcRotateCameraState {
        const result = new ArcRotateCameraState(mainScene, orbitCamera, freeCamera);
        result.alpha = normalizeAngle(this.alpha);
        result.beta = normalizeAngle(this.beta);
        result.radius = this.radius;
        result.fov = this.fov;
        result.position = this.position.clone();
        result.target = this.target.clone();
        result.viewToWorldScale = this.viewToWorldScale;
        return result;
    }

    public interpolateToState(lerpTarget: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string> {

        if (lerpTarget instanceof FreeCameraState) {

            onChangeToFreeMode.next();
            setActiveCamera(freeCamera, mainScene);

            const freeCameraState = new FreeCameraState(mainScene, orbitCamera, freeCamera, this);
            freeCamera.setCameraState(freeCameraState);

            return freeCameraState.interpolateToState(lerpTarget, engine, mainScene, orbitCamera, freeCamera);

        } else if (lerpTarget instanceof ArcRotateCameraState) {
            this.setupPseudoOrthogonalPositionToCamera(orbitCamera, lerpTarget);
            this.shortestAlphaBetaToState(lerpTarget);
        }
        return this.setupInterpolationObserver(lerpTarget, engine, mainScene, orbitCamera, freeCamera);
    }

    protected interpolate(lerpTarget: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void {

        CameraState.elapsedLerpTime += engine.getDeltaTime() * 0.001;
        let lerpTime = CameraState.elapsedLerpTime / CameraState.interpolationDuration;
        const easedInLerpTime = easeIn(lerpTime);

        lerpTime = (lerpTime > 1) ? 1 : lerpTime;

        const easeOutSine = Math.sin((lerpTime * Math.PI) * 0.5);
        if (lerpTarget instanceof ArcRotateCameraState) {
            if (CameraState.lastArcRotateState) {
                // @ts-ignore
                CameraState.scratchArcRotateState.target.subtractInPlace(CameraState.lastArcRotateState.target.subtract(orbitCamera._target));
                CameraState.scratchArcRotateState.radius += orbitCamera.radius - CameraState.lastArcRotateState.radius;
                CameraState.scratchArcRotateState.alpha -= orbitCamera.alpha - CameraState.lastArcRotateState.alpha;
                CameraState.scratchArcRotateState.beta -= orbitCamera.beta - CameraState.lastArcRotateState.beta;
            }

            let fovLerpValue = this.pseudoOrthogonalPosition ? easeOutQuint(lerpTime) : undefined;
            fovLerpValue = lerpTarget.pseudoOrthogonalPosition ? easeInQuint(lerpTime) : undefined;
            fovLerpValue = fovLerpValue ? fovLerpValue : easedInLerpTime;

            const lerpRadius = Scalar.Lerp(this.radius, lerpTarget.radius, fovLerpValue);
            orbitCamera.radius = lerpRadius + CameraState.scratchArcRotateState.radius;
            // @ts-ignore
            orbitCamera._target = Vector3.Lerp(this.target, lerpTarget.target, easedInLerpTime).addInPlace(CameraState.scratchArcRotateState.target);

            orbitCamera.alpha = Scalar.Lerp(this.alpha, lerpTarget.alpha, easeOutSine);
            orbitCamera.beta = Scalar.Lerp(this.beta, lerpTarget.beta, easeOutSine);


            const lerpSize = this.interpolateWorldSnapshotSize(lerpTarget, fovLerpValue);
            if (lerpSize) {
                this.calculateFovFromScreenAspect(orbitCamera, lerpRadius, lerpSize);
                CameraState.lastArcRotateState = orbitCamera.getCameraState(mainScene, orbitCamera, freeCamera, CameraState.lastArcRotateState);
                onAfterCameraHasMoved.next();
            }
        }

        if (lerpTime === 1) {
            this.endInterpolate(lerpTarget, mainScene, orbitCamera, freeCamera);
            return;
        }
    }

    private shortestAlphaBetaToState(targetState: ArcRotateCameraState): void {
        if (Math.abs(this.alpha - targetState.alpha) > Math.PI) {

            let correctedRotation = this.correctRotation(this.alpha);
            if (correctedRotation) this.alpha = correctedRotation;
            else {
                correctedRotation = this.correctRotation(targetState.alpha);
                if (correctedRotation) targetState.alpha = correctedRotation;
            }
        }
    }

    private correctRotation(rotation: number): number | null {
        if (rotation < Math.HALF_PI) {
            return rotation + Math.TAU;
        } else if (rotation > (Math.PI + Math.HALF_PI)) {
            return rotation - Math.TAU;
        } else {
            return null;
        }
    }

    public setupFromTargetPosition(): void {

        const computationVector = this.position.clone().subtractInPlace(this.target);

        this.radius = computationVector.length();

        if (this.radius === 0) {
            this.radius = 0.0001; // Just to avoid division by zero
        }

        if (computationVector.x === 0 && computationVector.z === 0) {
            this.alpha = Math.HALF_PI; // avoid division by zero when looking along up axis, and set to acos(0)
        } else {
            this.alpha = Math.acos(computationVector.x / Math.sqrt(Math.pow(computationVector.x, 2) + Math.pow(computationVector.z, 2)));
        }

        if (computationVector.z < 0) {
            this.alpha = Math.TAU - this.alpha;
        }

        this.beta = Math.acos(computationVector.y / this.radius);
    }

    public getQuaternion(): Quaternion {

        const position = new Vector3();
        position.z = Math.sin(this.alpha + Math.PI) * Math.cos(this.beta + Math.TAU);
        position.x = Math.cos(this.alpha + Math.PI) * Math.cos(this.beta + Math.TAU);
        position.y = Math.sin(this.beta + Math.TAU);

        const forward = position.clone().multiplyInPlace(new Vector3(-1, -1, -1));
        const right = Vector3.Cross(forward, new Vector3(0, -1, 0)).normalize();
        const up = Vector3.Cross(forward, right);

        return Quaternion.RotationQuaternionFromAxis(right, up, forward);
    }

    public checkLimits(camera: ArcRotateCamera): void {
        if (camera.lowerBetaLimit === null || camera.lowerBetaLimit === undefined) {
            if (camera.allowUpsideDown && this.beta > Math.PI) {
                this.beta = this.beta - Math.TAU;
            }
        } else {
            if (this.beta < camera.lowerBetaLimit) {
                this.beta = camera.lowerBetaLimit;
            }
        }

        if (camera.upperBetaLimit === null || camera.upperBetaLimit === undefined) {
            if (camera.allowUpsideDown && this.beta < -Math.PI) {
                this.beta = this.beta + Math.TAU;
            }
        } else {
            if (this.beta > camera.upperBetaLimit) {
                this.beta = camera.upperBetaLimit;
            }
        }

        if (camera.lowerAlphaLimit !== null && this.alpha < camera.lowerAlphaLimit) {
            this.alpha = camera.lowerAlphaLimit;
        }
        if (camera.upperAlphaLimit !== null && this.alpha > camera.upperAlphaLimit) {
            this.alpha = camera.upperAlphaLimit;
        }

        if (camera.lowerRadiusLimit !== null && this.radius < camera.lowerRadiusLimit) {
            this.radius = camera.lowerRadiusLimit;
        }
        if (camera.upperRadiusLimit !== null && this.radius > camera.upperRadiusLimit) {
            this.radius = camera.upperRadiusLimit;
        }
    }
}

declare module '@babylonjs/core/Cameras/arcRotateCamera.js' {

    interface ArcRotateCamera {
        getCameraState(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, state?: ArcRotateCameraState): ArcRotateCameraState;
        setCameraState(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, state: CameraState): void;
        interpolateTo(target: CameraTarget, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string>;
    }
}

ArcRotateCamera.prototype.getCameraState = function(this: ArcRotateCamera, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, state?: ArcRotateCameraState): ArcRotateCameraState {

    state = state ? state : new ArcRotateCameraState(mainScene, orbitCamera, freeCamera);
    state.alpha = normalizeAngle(this.alpha);
    state.beta = normalizeAngle(this.beta);
    state.radius = this.radius;
    state.fov = this.fov;
    state.position = this._position.clone();
    state.target = this._target.clone();
    state.setupWorldSize();

    return state;
};

ArcRotateCamera.prototype.setCameraState = function(this: ArcRotateCamera, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, state: CameraState): void {

    const arcState = new ArcRotateCameraState(mainScene, orbitCamera, freeCamera, state);

    // @ts-ignore
    this._position = arcState.position.clone();
    // @ts-ignore
    this._target = arcState.target.clone();

    this.radius = arcState.radius;
    this.alpha = normalizeAngle(arcState.alpha);
    this.beta = normalizeAngle(arcState.beta);
    this.fov = arcState.fov;
};

ArcRotateCamera.prototype.interpolateTo = function(this: ArcRotateCamera, target: CameraTarget, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string> {
    if (!(mainScene.activeCamera instanceof ArcRotateCamera)) {
        console.error('Attempting to interpolate inactive camera');
        setActiveCamera(this, mainScene);
    }
    return this.getCameraState(mainScene, orbitCamera, freeCamera).interpolateTo(target, mainScene, orbitCamera, freeCamera);
};


/** Possible values 'FirstPerson' and 'Orbit' */
enum CAMERA_TYPE {
  FirstPerson,
  Orbit,
}
