import '@babylonjs/core/Engines/engine';
import { Scene, TransformNode, Vector3 } from '@babylonjs/core';
/**
 * Download and import Tridify Models to scene with IFC data added into meshes.
 * @param {Scene} scene - The Babylon.js Scene to import meshes to.
 * @param {string[]} gltfFileUrls - Array of glTF file URLs to import.
 * @param {Map<string, string>} linkedFilesMap - Optional - Helps sub-tracker to calculate loading bar right. Default value is empty new Map().
 * @param {Map<string, string>} ifcIdByFilename - Optional - Adds meshes ifc model id. Default value is empty new Map().
 * @param {(vector: Vector3) => void} getModelOffset - Optional - void function passing model offset.
 * @param {any} subTrackers - Optional - This is used to handle loading phase.
 * @returns {Promise<TransformNode>} - The node in the Babylon.js Scene under which the imported meshes were added
 */
export declare function loadGltfFiles(scene: Scene, gltfFileUrls: string[], linkedFilesMap?: Map<string, string>, ifcIdByFilename?: Map<string, string>, getModelOffset?: (vector: Vector3) => void, subTrackers?: any): Promise<TransformNode>;
