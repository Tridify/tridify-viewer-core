import { Quaternion, Vector3, Matrix, FreeCamera, Epsilon, ISize, Scalar, Scene, Engine, ArcRotateCamera } from '@babylonjs/core';
import { ArcRotateCameraState } from './ArcRotateCameraState';
import { CameraState, CameraTarget } from './CameraState';
import { setActiveCamera, freeCameraFov, onChangeToOrbitMode, onChangeToFreeMode, onAfterCameraHasMoved, freeCameraMinZ, orbitCameraMinZ } from './cameraUtils';
// import { Viewpoint, PerspectiveCamera, CAMERA_TYPE } from '@/tools/CommentingTool/Viewpoint';
// import { v4 as uuidV4 } from 'uuid';
import { easeIn, easeInQuint, easeOutQuint } from '../mathHelper';
export class FreeCameraState extends CameraState {

    public position: Vector3 = Vector3.Zero();
    public pseudoOrthogonalPosition?: Vector3;
    public target: Vector3 = Vector3.Zero();
    public rotation: Vector3 = Vector3.Zero();
    public fov: number = 0;
    public static virtualTargetDistance: number = 5;
    public radius: number = 0;

    public constructor(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, cameraState?: CameraState) {
        super(mainScene, orbitCamera, freeCamera);
        if (cameraState) this.fromCameraState(cameraState);
    }

    public getClassName(): string {
        return 'FreeCameraState';
    }

    public fromCameraState(cameraState: CameraState): void {
        this.fov = cameraState.fov;
        this.position = cameraState.position.clone();
        this.target = cameraState.target.clone();
        this.rotation = this.getRotation();
        this.setupWorldSize();
        this.radius = cameraState.radius;
    }

    /*public async fromViewpoint(viewpoint: Viewpoint): Promise<any> {

        if (viewpoint.orthogonalCamera) console.error(`Orthogonal viewpoint set to first person camera.`);

        this.position = viewpoint.perspectiveCamera ? viewpoint.perspectiveCamera.cameraViewPoint.clone() : Vector3.Zero();
        this.target = viewpoint.target.clone();
        this.fov = viewpoint.perspectiveCamera ? viewpoint.perspectiveCamera.fieldOfView : freeCameraFov;
        this.rotation = this.getRotation();
        //this.associatedViewpoint = viewpoint;

        this.viewWorldSize = await viewpoint.getWorldSnapshotSize();

        this.radius = Vector3.Distance(this.position, this.target);

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
        perspectiveCamera.cameraViewPoint = this.position.clone();
        perspectiveCamera.cameraDirection = forward;
        perspectiveCamera.cameraUpVector = up;
        perspectiveCamera.fieldOfView = this.fov;

        viewpoint.perspectiveCamera = perspectiveCamera;

        viewpoint.cameraType = CAMERA_TYPE.FirstPerson;
        viewpoint.target = this.target.clone();

        return viewpoint;
    }*/

    public clone(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): FreeCameraState {
        const result = new FreeCameraState(mainScene, orbitCamera, freeCamera);
        result.position = this.position.clone();
        result.fov = this.fov;
        result.target = this.target.clone();
        result.rotation = this.rotation.clone();
        result.radius = this.radius;
        return result;
    }

    public interpolateToState(lerpTarget: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string> {

        if (lerpTarget instanceof ArcRotateCameraState) {

            setActiveCamera(orbitCamera, mainScene);

            const arcRotateCameraState = new ArcRotateCameraState(mainScene, orbitCamera, freeCamera, this);
            orbitCamera.setCameraState(mainScene, orbitCamera, freeCamera, arcRotateCameraState);

            return arcRotateCameraState.interpolateToState(lerpTarget, engine, mainScene, orbitCamera, freeCamera);
        } else if (lerpTarget instanceof FreeCameraState) {
            this.setupPseudoOrthogonalPositionToCamera(orbitCamera, lerpTarget);
        }
        return this.setupInterpolationObserver(lerpTarget, engine, mainScene, orbitCamera, freeCamera);
    }

    protected interpolate(lerpTarget: CameraState, engine: Engine, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): void {

        CameraState.elapsedLerpTime += engine.getDeltaTime() * 0.001;
        let lerpTime = CameraState.elapsedLerpTime / CameraState.interpolationDuration;
        const easedInLerpTime = easeIn(lerpTime);

        lerpTime = (lerpTime > 1) ? 1 : lerpTime;

        if (lerpTarget instanceof FreeCameraState) {

            if (CameraState.lastFreeState) {
                CameraState.scratchFreeState.rotation.subtractInPlace(CameraState.lastFreeState.rotation.subtract(freeCamera.rotation));
                CameraState.scratchFreeState.position.subtractInPlace(CameraState.lastFreeState.position.subtract(freeCamera._position));
            }

            let fovLerpValue = this.pseudoOrthogonalPosition ? easeOutQuint(lerpTime) : undefined;
            fovLerpValue = lerpTarget.pseudoOrthogonalPosition ? easeInQuint(lerpTime) : undefined;
            fovLerpValue = fovLerpValue ? fovLerpValue : easedInLerpTime;

            const lerpRadius = Scalar.Lerp(this.radius, lerpTarget.radius, fovLerpValue);
            const lerpPosition = Vector3.Lerp(this.position, lerpTarget.position, easedInLerpTime);
            const lerpTargetPosition = Vector3.Lerp(this.target, lerpTarget.target, easedInLerpTime);

            freeCamera._position = lerpPosition.addInPlace(CameraState.scratchFreeState.position);
            freeCamera._currentTarget = lerpTargetPosition;

            this.correctCameraCloseTarget(freeCamera, lerpTarget);

            freeCamera.setTargetWithOffsetRotation(freeCamera._currentTarget, CameraState.scratchFreeState.rotation, freeCamera);

            const lerpSize = this.interpolateWorldSnapshotSize(lerpTarget, fovLerpValue);
            if (lerpSize) {
                this.calculateFovFromScreenAspect(freeCamera, lerpRadius, lerpSize);
                CameraState.lastFreeState = freeCamera.getCameraState(mainScene, orbitCamera, freeCamera, CameraState.lastFreeState);
                onAfterCameraHasMoved.next();
            }
        }

        if (lerpTime === 1) {
            this.endInterpolate(lerpTarget, mainScene, orbitCamera, freeCamera);
            return;
        }
    }

    public getRotation(position?: Vector3, target?: Vector3): Vector3 {

        position = position ? position : this.position;
        target = target ? target : this.target;

        const rotation = Vector3.Zero();

        if (position.z === target.z) {
            position.z += Epsilon;
        }

        const matrix = Matrix.Identity();

        Matrix.LookAtLHToRef(position, target, Vector3.Up(), matrix);
        matrix.invert();

        rotation.x = Math.atan(matrix.m[6] / matrix.m[10]);

        const vDir = target.subtract(position);

        if (vDir.x >= 0.0) {
            rotation.y = (-Math.atan(vDir.z / vDir.x) + Math.PI / 2.0);
        } else {
            rotation.y = (-Math.atan(vDir.z / vDir.x) - Math.PI / 2.0);
        }

        rotation.z = 0;

        if (isNaN(rotation.x)) {
            rotation.x = 0;
        }

        if (isNaN(rotation.y)) {
            rotation.y = 0;
        }

        if (isNaN(rotation.z)) {
            rotation.z = 0;
        }
        return rotation;
    }

    public getQuaternion(position?: Vector3, target?: Vector3): Quaternion {

        position = position ? position : this.position;
        target = target ? target : this.target;

        const camMatrix = Matrix.LookAtLH(position, target, Vector3.Up());
        camMatrix.invert();

        const direction = target.clone().subtractInPlace(position);

        const x = Math.atan(camMatrix.m[6] / camMatrix.m[10]);
        const y = (direction.x >= 0.0) ? (-Math.atan(direction.z / direction.x) + Math.HALF_PI) : (-Math.atan(direction.z / direction.x) - Math.HALF_PI);

        return Quaternion.RotationYawPitchRoll(y, x, 0);
    }

    /**
     * Correct for going through look target as to not flip view direction too fast
     */
    private correctCameraCloseTarget(camera: FreeCamera, lerpTarget: CameraState) {
        const distance = Vector3.Distance(camera._position, camera._currentTarget);

        if (distance < FreeCameraState.virtualTargetDistance) {
            const correction = FreeCameraState.virtualTargetDistance - distance;
            const movementDirection = this.position.subtract(lerpTarget.position).normalize();
            const correctionDirection = Vector3.Cross(movementDirection, Vector3.Down()).normalize().scale(correction);
            camera._position = camera._position.add(correctionDirection);
        }
    }
}

declare module '@babylonjs/core/Cameras/freeCamera.js' {

    interface FreeCamera {
        getCameraState(mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, state?: FreeCameraState): FreeCameraState;
        setCameraState(state: CameraState): void;
        interpolateTo(target: CameraTarget, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string>;
        setTargetWithOffsetRotation(target: Vector3, offsetRotation: Vector3, freeCamera: FreeCamera): void;
    }
}

FreeCamera.prototype.getCameraState = function(this: FreeCamera, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera, state?: FreeCameraState): FreeCameraState {
    state = state ? state : new FreeCameraState(mainScene, orbitCamera, freeCamera);

    state.position = this._position.clone();
    state.fov = this.fov;

    const direction = Vector3.Forward().rotateDirectionByQuaternion(this.rotationQuaternion);
    state.target = this._position.clone().addInPlace(direction.scaleInPlace(FreeCameraState.virtualTargetDistance));
    state.rotation = this.rotation.clone();
    state.radius = Vector3.Distance(state.position, state.target);

    state.setupWorldSize();

    return state;
};

FreeCamera.prototype.setCameraState = function(this: FreeCamera, state: CameraState): void {

    this.fov = state.fov;
    this._position = state.position.clone();
    this.setTarget(state.target.clone());
};

FreeCamera.prototype.interpolateTo = function(this: FreeCamera, target: CameraTarget, mainScene: Scene, orbitCamera: ArcRotateCamera, freeCamera: FreeCamera): Promise<string> {
    if (!(mainScene.activeCamera instanceof FreeCamera)) {
        console.error('Attempting to interpolate inactive camera');
        setActiveCamera(this, mainScene);
    }
    return this.getCameraState(mainScene, orbitCamera, freeCamera).interpolateTo(target, mainScene, orbitCamera, freeCamera);
};

FreeCamera.prototype.setTargetWithOffsetRotation = function(target: Vector3, offsetRotation: Vector3, freeCamera: FreeCamera): void {
    this.upVector.normalize();

    this._initialFocalDistance = target.subtract(this.position).length();

    if (this.position.z === target.z) {
        this.position.z += Epsilon;
    }

    this._referencePoint.normalize().scaleInPlace(this._initialFocalDistance);

    //TODO: Remove this ts-ignore
    // @ts-ignore
    Matrix.LookAtLHToRef(this.position, target, this._defaultUp, this._camMatrix);
    this._camMatrix.invert();

    this.rotation.x = Math.atan(this._camMatrix.m[6] / this._camMatrix.m[10]);

    const vDir = target.subtract(this.position);

    if (vDir.x >= 0.0) {
        this.rotation.y = (-Math.atan(vDir.z / vDir.x) + Math.PI / 2.0);
    } else {
        this.rotation.y = (-Math.atan(vDir.z / vDir.x) - Math.PI / 2.0);
    }

    this.rotation.z = 0;

    if (isNaN(this.rotation.x)) {
        this.rotation.x = 0;
    }

    if (isNaN(this.rotation.y)) {
        this.rotation.y = 0;
    }

    if (isNaN(this.rotation.z)) {
        this.rotation.z = 0;
    }

    this.rotation = freeCamera.rotation.add(offsetRotation);

    if (this.rotationQuaternion) {
        Quaternion.RotationYawPitchRollToRef(this.rotation.y, this.rotation.x, this.rotation.z, this.rotationQuaternion);
    }
};

/** Possible values 'FirstPerson' and 'Orbit' */
enum CAMERA_TYPE {
  FirstPerson,
  Orbit,
}
