
import { Scene, Matrix, Vector3, Vector2, Color3, Color4, Quaternion, PrecisionDate, Ray, BoundingSphere, Engine } from '@babylonjs/core';
import { DeepImmutable, Nullable } from '@babylonjs/core';
// Ensure this is treated as a module.

//#region Math helpers
declare global {

    interface Math {
        /** Tau. This is the ratio of the circumference of a circle to its radius. */
        TAU: number;

        HALF_PI: number;

        /** Modulo operation. remainder or signed remainder after division of dividend by divisor */
        mod: (dividend: number, divisor: number) => number;

        clamp(value: number, min: number, max: number): number;

        randomFloatInRange: (min: number, max: number) => number;

        RAD_TO_DEG: number;

        DEG_TO_RAD: number;

    }

    interface StringConstructor {
        isNumeric: (str: string) => boolean;
        isFloat: (str: string) => boolean;
    }
}
// TODO: check if this needed
String.isNumeric = (str: string): boolean => {
    if (typeof str !== 'string') return false;
    return !isNaN(str as any) && !isNaN(parseFloat(str));
};
// TODO: check if this needed
String.isFloat = (str: string): boolean => {
    return String.isNumeric(str) && str.includes('.');
};
export function mathClamp(value, min, max): number {
    return Math.min(Math.max(value, min), max);
}
// TODO: check if this needed
Math.randomFloatInRange = (min: number, max: number): number => {
    return (Math.random() * (max - min + 1)) + min;
};

// TODO: check if these works fine
Math.TAU = Math.PI * 2;
Math.HALF_PI = Math.PI * 0.5;
Math.mod = (dividend, divisor) => ((dividend % divisor) + divisor) % divisor;
Math.RAD_TO_DEG = 180 / Math.PI;
Math.DEG_TO_RAD = Math.PI / 180;

//#endregion

//#region interpolation easing
export function easeIn(t: number): number { return ((--t) * t * t + 1); }

export function easeRot(t: number): number { return (t < .5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t); }

export function easeOut(t: number): number { return (1 + (--t) * t * t * t * t); }

export function easeInQuint(t: number): number { return t ** 5; }

export function easeOutQuint(t: number): number { return 1 - ((1 - t) ** 5); }

export function isInt(str: any) { return (typeof str !== 'string') ? false : !isNaN(str as any) && !isNaN(parseInt(str, 10)); }

export function getSinePhase(cycleLength: number, min: number, max: number): number {
    const phaseInSeconds = PrecisionDate.Now % cycleLength;
    const normalizedPhase = phaseInSeconds / cycleLength;
    const sine = Math.sin(normalizedPhase * 360 / (180 / Math.PI));
    const normalizedSine = (sine + 1) / 2;
    return normalizedSine * (max - min) + min;
}

export function normalizeAngle(angle: number): number {
    angle = angle % Math.TAU;
    if (angle < 0) angle = Math.TAU + angle;
    return angle;
}

//#endregion

//#region DataView extensions
declare global {
    interface DataView {
        getUint24(pos: number): number;
        setUint24(pos: number, val: number): void;
    }
}

/* tslint:disable:no-bitwise */
DataView.prototype.getUint24 = function(pos: number): number {
    return (this.getUint16(pos) << 8) + this.getUint8(pos + 2);
};

DataView.prototype.setUint24 = function(pos: number, val: number) {
    this.setUint16(pos, val >> 8);
    this.setUint8(pos + 2, val & ~4294967040); // this "magic number" masks off the first 16 bits
};
/* tslint:enable */

//#endregion

//#region Ray helpers
declare module '@babylonjs/core/Culling/ray.js' {

    interface Ray {
        signedDistanceToSphereSurface(sphere: DeepImmutable<BoundingSphere>): Nullable<number>;
    }
}
export function signedDistanceToSphereSurface(ray: Ray, sphere: DeepImmutable<BoundingSphere>): Nullable<number> {
    const sphereRadius = sphere.radiusWorld;

    const rayOffsetFromCenter = sphere.centerWorld.subtract(ray.origin);

    const rayToCenterDistance = rayOffsetFromCenter.length();

    const rayToCenterAlongRayDistance = Vector3.Dot(rayOffsetFromCenter, ray.direction);
    const rayToSurfaceDistance = rayToCenterDistance - rayToCenterAlongRayDistance;
    const surfaceToCenterAlongRayDistance = sphereRadius - rayToSurfaceDistance;

    if (sphereRadius - rayToCenterDistance + rayToCenterAlongRayDistance < surfaceToCenterAlongRayDistance) {
        return null;
    }

    return rayToCenterAlongRayDistance - surfaceToCenterAlongRayDistance;
}

/*Ray.prototype.signedDistanceToSphereSurface = function(this: Ray, sphere: DeepImmutable<BoundingSphere>): Nullable<number> {
    const sphereRadius = sphere.radiusWorld;

    const rayOffsetFromCenter = sphere.centerWorld.subtract(this.origin);

    const rayToCenterDistance = rayOffsetFromCenter.length();

    const rayToCenterAlongRayDistance = Vector3.Dot(rayOffsetFromCenter, this.direction);
    const rayToSurfaceDistance = rayToCenterDistance - rayToCenterAlongRayDistance;
    const surfaceToCenterAlongRayDistance = sphereRadius - rayToSurfaceDistance;

    if (sphereRadius - rayToCenterDistance + rayToCenterAlongRayDistance < surfaceToCenterAlongRayDistance) {
        return null;
    }

    return rayToCenterAlongRayDistance - surfaceToCenterAlongRayDistance;
};*/


//#endregion

//#region Quaternion helpers

declare module '@babylonjs/core/Maths/math.vector.js' {

    interface Quaternion {
        /**
         * Rotate a direction by the this Quaternion
         * @param direction the direction to rotate
         * @returns the rotated vector
         */
        rotateDirection(this: Quaternion, direction: Vector3): Vector3;

        /**
         * Get the difference quaternion between this and a given quaternion
         * @param that the quaternion to get the difference to
         * @returns The difference quaternion
         */
        difference(this: Quaternion, that: Quaternion): Quaternion;
    }
}

export function quaternionDifference(thisQuaternion: Quaternion, thatQuaternion: Quaternion): Quaternion {
    let result = Quaternion.Identity();
    result = thisQuaternion.multiply(Quaternion.InverseToRef(thatQuaternion, result));
    return result;
}
/*Quaternion.prototype.difference = function(this: Quaternion, that: Quaternion): Quaternion {
    let result = Quaternion.Identity();
    result = this.multiply(Quaternion.InverseToRef(that, result));
    return result;
};*/

export function rotateDirection(quaternion: Quaternion, direction: Vector3): Vector3 {

    const num1 = quaternion.x * 2;
    const num2 = quaternion.y * 2;
    const num3 = quaternion.z * 2;
    const num4 = quaternion.x * num1;
    const num5 = quaternion.y * num2;
    const num6 = quaternion.z * num3;
    const num7 = quaternion.x * num2;
    const num8 = quaternion.x * num3;
    const num9 = quaternion.y * num3;
    const num10 = quaternion.w * num1;
    const num11 = quaternion.w * num2;
    const num12 = quaternion.w * num3;

    const vector = Vector3.Zero();
    vector.x = (1 - (num5 + num6)) * direction.x + (num7 - num12) * direction.y + (num8 + num11) * direction.z;
    vector.y = (num7 + num12) * direction.x + (1.0 - (num4 + num6)) * direction.y + (num9 - num10) * direction.z;
    vector.z = (num8 - num11) * direction.x + (num9 + num10) * direction.y + (1 - (num4 + num5)) * direction.z;

    return vector;
};





//#endregion

//#region Vector helpers

declare module '@babylonjs/core/Maths/math.vector.js' {

    interface Vector3 {
        /**
         * Rotate a direction by a Quaternion
         * @param quaternion the quaternion to rotate this directional vector with
         * @returns the rotated vector
         */
        rotateDirectionByQuaternion(this: Vector3, quaternion: Quaternion): Vector3;
    }
}

export function rotateDirectionByQuaternion(vector: Vector3, quaternion: Quaternion): Vector3 {
    const num1 = quaternion.x * 2;
    const num2 = quaternion.y * 2;
    const num3 = quaternion.z * 2;
    const num4 = quaternion.x * num1;
    const num5 = quaternion.y * num2;
    const num6 = quaternion.z * num3;
    const num7 = quaternion.x * num2;
    const num8 = quaternion.x * num3;
    const num9 = quaternion.y * num3;
    const num10 = quaternion.w * num1;
    const num11 = quaternion.w * num2;
    const num12 = quaternion.w * num3;

    const x = vector.x;
    const y = vector.y;
    const z = vector.z;

    vector.x = (1 - (num5 + num6)) * x + (num7 - num12) * y + (num8 + num11) * z;
    vector.y = (num7 + num12) * x + (1.0 - (num4 + num6)) * y + (num9 - num10) * z;
    vector.z = (num8 - num11) * x + (num9 + num10) * y + (1 - (num4 + num5)) * z;

    return vector;
}

/**
 * Return the normal of the facet from facet vertex positions
 * @param vertexPositions The facet vertex positions
 * @returns the normal of the face
 */
export function normalFromFacetPositions(vertexPositions: Array<DeepImmutable<Vector3>>): Vector3 {

    const dir1 = vertexPositions[0].subtract(vertexPositions[1]);
    const dir2 = vertexPositions[2].subtract(vertexPositions[1]);
    return Vector3.Cross(dir1, dir2).normalize();
}

/**
 * Project a position from reference along a given direction
 * @param {Vector3} reference - the position to calculate distance from
 * @param {Vector3} position - the position to calculate distance to
 * @param {Vector3} direction - the direction to project distance along
 * @returns {Vector3} - the projected position
 */
export function getProjectedPosition(reference: DeepImmutable<Vector3>, position: DeepImmutable<Vector3>, direction: DeepImmutable<Vector3>): DeepImmutable<Vector3> {
    const distanceToSecondPoint = Vector3.Dot(position, direction) - Vector3.Dot(direction, reference);
    return reference.add(new Vector3(direction.x * distanceToSecondPoint, direction.y * distanceToSecondPoint, direction.z * distanceToSecondPoint));
}

/**
 * Given an array of directions. return the one that is closer to the reference direction
 * @param {Vector3[]} lineDirections - array of directions to get closest from
 * @param {Vector3} referenceDirection - the direction to calculate closest direction from
 * @returns {Nullable<Vector3>} - the closest direction or null if no closest direction can be found
 */
export function getClosestDirection(lineDirections: Vector3[], referenceDirection: Vector3): Nullable<Vector3> {

    let closestDirSimilarity = -1;
    let closestDir: Nullable<Vector3> = null;
    lineDirections.forEach((lineDir: Vector3) => {
        const angle = Vector3.Dot(referenceDirection, lineDir);
        if (angle > closestDirSimilarity) {
            closestDirSimilarity = angle;
            closestDir = lineDir;
        }
    });
    return closestDir;
}

/**
 * Getting closest vertex position index in a facet from barycentric weights
 * (Facet vertices are always in the same order, ergo we don't need to know about anything from the facet or its vertices)
 * @param {[number, number, number]} barycentricWeights - barycentric weights
 * @returns {number} the closest vertex index in the facet
 */
export function getClosestVertIndex(barycentricWeights: [number, number, number]): number {
    let closestNum = 0;
    let closestBar = barycentricWeights[0];
    if (barycentricWeights[1] < closestBar) {
        closestBar = barycentricWeights[1];
        closestNum = 1;
    }
    if (barycentricWeights[2] < closestBar) {
        closestBar = barycentricWeights[2];
        closestNum = 2;
    }
    return closestNum;
}

/**
 * Get the screen-space position of a point in world space as a Vector2
 * @param {Vector3} position - a Vector3 position in world space
 * @returns {Vector2} the screen-space position
 */
export function getScreenPos(position: DeepImmutable<Vector3>, mainScene: Scene, engine: Engine): Vector2 {

    const transformMatrix = mainScene.getTransformMatrix();
    const engineWidthHeight = new Vector2(engine!.getRenderWidth(), engine!.getRenderHeight());
    const globalViewport = mainScene.activeCamera!.viewport.toGlobal(
        engineWidthHeight.x,
        engineWidthHeight.y,
    );
    const screenPosition = Vector3.Project(
        position,
        Matrix.IdentityReadOnly,
        transformMatrix,
        globalViewport,
    );
    return new Vector2(screenPosition.x, screenPosition.y);
}

/**
 * Is the given world-space position visible on the screen
 * @param {Vector3} position - a world-space position
 * @returns {boolean} - is the position visible on the screen
 */
export function isVisibleOnScreen(position: Vector3, scene: Scene): boolean {

    const camDir = scene.activeCamera!.getDirection(Vector3.Forward())!;
    const lineDir = (position).subtract(scene.activeCamera!.position!).normalize();
    const isVisible = Vector3.Dot(camDir, lineDir) > 0;

    return isVisible;
}

//#endregion

//#region encoding/decoding integers

declare module '@babylonjs/core/Maths/math.color.js' {
    interface Color3 {
        fromUInt24(value: number): void;
        toUInt24(): number;
        /**
         * convert a Color3 to a string that is understood by the GLSL preprocessor
         * @returns a string that is understood by the GLSL preprocessor
         */
        toGLSL(): string;
    }
    interface Color4 {
        fromUInt32(value: number): Color4;
        toUInt32(): number;
        /**
         * convert a Color4 to a string that is understood by the GLSL preprocessor
         * @returns a string that is understood by the GLSL preprocessor
         */
        toGLSL(): string;
    }
}

/**
 * convert an unsigned 8 bit integer to a minifloat
 * @param int - an 8 bit unsigned integer
 * @returns minifloat
 */
export function uInt8ToMinifloat(int: number): number { return parseFloat((int / 255.0).toFixed(16)); }

const isLittleEndian = true; // Setting to littleEndian for prettier debugging
/**
 * convert an unsigned 32 bit integer to a Color3 uInt8 array
 * @param value - An unsigned 32 bit integer
 * @returns integer encoded to a Color3
 */
export function fromUInt32Color4(color: Color4, value: number): Color4 {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, isLittleEndian);

    color.r = view.getUint8(0);
    color.g = view.getUint8(1);
    color.b = view.getUint8(2);
    color.a = view.getUint8(3);

    return color;
}

/**
 * convert a Color3 uint8 array to an unsigned 32 bit integer
 * @returns number that is limited to an unsigned 32 bit integer size
 */
export function color4toUInt32(color: Color4): number {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint8(0, color.r);
    view.setUint8(1, color.g);
    view.setUint8(2, color.b);
    view.setUint8(3, color.a);
    return view.getUint32(0, isLittleEndian);
}

/**
 * convert an unsigned 24 bit integer to a Color3 uInt8 array
 * @param value - An unsigned 24 bit integer
 * @returns integer encoded to a Color3
 */
/*Color3.prototype.fromUInt24 = function(value: number): Color4 {

    if (value > 16777215) {
        throw new Error('The given value is overflowing the uInt24 range');
    }
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint24(0, value);
    this.r = view.getUint8(0);
    this.g = view.getUint8(1);
    this.b = view.getUint8(2);

    return this;
};*/

/**
 * convert a Color3 uint8 array to an unsigned 24 bit integer
 * @returns number that is limited to an unsigned 24 bit integer size
 */
export function color3toUInt24(color: Color3): number {
    const buffer = new ArrayBuffer(3);
    const view = new DataView(buffer);
    view.setUint8(0, color.r);
    view.setUint8(1, color.g);
    view.setUint8(2, color.b);
    return view.getUint24(0);
}

export function color3toGLSL(color: Color3): string {
    return `vec3 (${color.r}., ${color.g}., ${color.b}.)`;
};

export function color4toGLSL(color: Color4): string {
    return `vec4 (${color.r}., ${color.g}., ${color.b}., ${color.a}.)`;
}

//#endregion

//#region Date helpers
export function dateToIsoString(date: Date): string {
    const tzo = -date.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const pad = function(num: number) {
        const norm = Math.floor(Math.abs(num));
        return (norm < 10 ? '0' : '') + norm;
    };

    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        dif + pad(tzo / 60) +
        ':' + pad(tzo % 60);
}
//#endregion

