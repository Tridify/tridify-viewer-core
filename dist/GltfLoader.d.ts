import '@babylonjs/core/Engines/engine';
import { Scene, TransformNode, Vector3 } from '@babylonjs/core';
/**
 * Download and import Tridify Models to scene with IFC data added into meshes.
 * @param {Scene} scene - The Babylon scene to import meshes to.
 * @param {string[]} gltfFileUrls - Array of glTF model URLs to import.
 * @param {AbstractMesh[]} linkedFilesMap - Optional - Helps sub-tracker to calculate loading bar right. Default value is empty new Map().
 * @param {AbstractMesh[]} ifcIdByFilename - Optional - Adds meshes ifc model id. Default value is empty new Map().
 * @param {(vector: Vector3) => void} getModelOffset - Optional - void function passing model offset.
 * @param {any} subTrackers - Optional - This is used to handle loading phase.
 */
export declare function loadGltfFiles(scene: Scene, gltfFileUrls: string[], linkedFilesMap?: Map<string, string>, ifcIdByFilename?: Map<string, string>, getModelOffset?: (vector: Vector3) => void, tridifyMat?: any, subTrackers?: any): Promise<TransformNode>;
