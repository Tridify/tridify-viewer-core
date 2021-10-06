var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import '@babylonjs/core/Engines/engine';
import { FileTools, Mesh, SceneLoader, TransformNode, Vector3 } from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders';
import { uniq } from 'lodash';
import { EXT_mesh_gpu_instancing, ExtrasAsMetadata, GLTFLoader, KHR_materials_pbrSpecularGlossiness } from '@babylonjs/loaders/glTF/2.0';
/****
 * Override RequestFile to support progress on gzipped files with chrome
 * https://bugs.chromium.org/p/chromium/issues/detail?id=463622
 */
const requestFileBase = FileTools.RequestFile;
FileTools.RequestFile = (url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError, onOpened) => {
    const wrappedProgress = onProgress ? (event) => {
        var _a;
        const req = event.target;
        if (!event.lengthComputable && event.total === 0 && (req === null || req === void 0 ? void 0 : req.getResponseHeader('Content-Encoding')) === 'gzip') {
            // Multiply gltfContentLength so it is closer to the loaded length in Chrome.
            // uncompressed size could be sent in custom header
            const reqTotal = parseInt((_a = req === null || req === void 0 ? void 0 : req.getResponseHeader('Content-Length')) !== null && _a !== void 0 ? _a : '4000000', 10) * 4;
            onProgress({
                loaded: event.loaded,
                lengthComputable: true,
                total: reqTotal,
                target: event.target,
            });
        }
        else {
            onProgress(event);
        }
    } : undefined;
    return requestFileBase(url, onSuccess, wrappedProgress, offlineProvider, useArrayBuffer, onError, onOpened);
};
/**
 * Download and import Tridify Models to scene with IFC data added into meshes.
 * @param {Scene} scene - The Babylon scene to import meshes to.
 * @param {string[]} gltfFileUrls - Array of glTF model URLs to import.
 * @param {AbstractMesh[]} linkedFilesMap - Optional - Helps sub-tracker to calculate loading bar right. Default value is empty new Map().
 * @param {AbstractMesh[]} ifcIdByFilename - Optional - Adds meshes ifc model id. Default value is empty new Map().
 * @param {(vector: Vector3) => void} getModelOffset - Optional - void function passing model offset.
 * @param {any} subTrackers - Optional - This is used to handle loading phase.
 */
export function loadGltfFiles(scene, gltfFileUrls, linkedFilesMap = new Map(), ifcIdByFilename = new Map(), getModelOffset, tridifyMat, subTrackers) {
    return __awaiter(this, void 0, void 0, function* () {
        SceneLoader.RegisterPlugin(new GLTFFileLoader());
        GLTFLoader.RegisterExtension("ExtrasAsMetadata", (loader) => new ExtrasAsMetadata(loader));
        GLTFLoader.RegisterExtension("KHR_materials_pbrSpecularGlossiness", (loader) => new KHR_materials_pbrSpecularGlossiness(loader));
        GLTFLoader.RegisterExtension("EXT_mesh_gpu_instancing", (loader) => new EXT_mesh_gpu_instancing(loader));
        // Buffer binary files do not show in in progress total until they are requested
        // so an estimate of 1GB per file is used until the main file is parsed
        let parsed = false;
        const linkedFilesSizeEstimate = linkedFilesMap.size * 1024000000; // 1GB per file;
        SceneLoader.OnPluginActivatedObservable.add(function (loader) {
            if (loader.name === 'gltf') {
                const gltf = loader;
                gltf.validate = false; // with validation linked files are loaded twice
                gltf.onParsed = ld => { parsed = true; };
                gltf.preprocessUrlAsync = x => {
                    var _a;
                    const filename = x.substring(x.lastIndexOf('/') + 1);
                    const linked = (_a = linkedFilesMap.get(filename)) !== null && _a !== void 0 ? _a : "";
                    return Promise.resolve(linked);
                };
            }
        });
        SceneLoader.ShowLoadingScreen = false;
        const mergedMeshesNode = new TransformNode('MergedMeshes', scene);
        yield Promise.all(gltfFileUrls.map(url => SceneLoader.AppendAsync('', url, scene, progress => {
            const totalProgress = parsed ? progress.total : progress.total + linkedFilesSizeEstimate;
            if (subTrackers)
                subTrackers.importModels.UpdateProgress((progress.loaded / totalProgress) * 1.05);
        }, ".glb")));
        let extras = { centeringOffset: [], ifc: [] };
        scene.transformNodes.forEach(node => {
            if (node.metadata && node.metadata.gltf && node.metadata.gltf.extras) {
                extras = node.metadata.gltf.extras;
                node.dispose();
            }
        });
        if (extras.centeringOffset && getModelOffset !== undefined) {
            const x = Number(extras.centeringOffset[0]);
            const y = Number(extras.centeringOffset[1]);
            const z = Number(extras.centeringOffset[2]);
            getModelOffset(new Vector3(-x, y, z));
        }
        const firstDataValue = Object.values(extras.ifc)[0];
        const firstIfcType = firstDataValue.ifcType;
        const firstIfcStorey = firstDataValue.ifcStorey;
        const firstIfcFilename = firstDataValue.ifcFilename;
        let ifcNames = scene.meshes.map(mesh => {
            if (mesh.name !== 'navigationMesh' && mesh.name !== '__root__') {
                if (!mesh.hasInstances) {
                    const postProcessMeshData = extras.ifc[mesh.name];
                    if (postProcessMeshData && postProcessMeshData[0]) {
                        return postProcessMeshData[0].ifcFilename;
                    }
                }
            }
        }).filter(x => !!x);
        ifcNames = uniq(ifcNames);
        ifcNames = ifcNames.map(name => name.split('.ifc')[0]);
        const instancesRoot = scene.getTransformNodeByName('instances');
        if (instancesRoot) {
            instancesRoot.getDescendants(false).map(node => {
                var _a;
                if (node instanceof Mesh && node.hasInstances) {
                    const mesh = node;
                    mesh.name = mesh.name.split('_primitive')[0];
                    mesh.flipFaces(false);
                    const pivotMatrix = mesh.getPivotMatrix();
                    const meshMatrix = mesh.computeWorldMatrix(true).multiply(pivotMatrix);
                    mesh.resetLocalMatrix(true);
                    const bufferMatrices = new Float32Array(16 * (mesh.instances.length + 1));
                    mesh.instanceIfcDataByGuid = new Map();
                    mesh.instances.forEach((instance, index) => {
                        instance.name = instance.name.split('_primitive')[0];
                        const instanceMatrix = instance.computeWorldMatrix(true).multiply(pivotMatrix);
                        instanceMatrix.copyToArray(bufferMatrices, index * 16);
                        const instanceIfcData = extras.ifc[instance.name];
                        if (instanceIfcData)
                            mesh.instanceIfcDataByGuid.set(instance.name, instanceIfcData);
                        else {
                            console.error(`Instance ${instance.name} ${index + 1} of ${mesh.instances.length} doesn't have any ifc data!`);
                        }
                    });
                    meshMatrix.copyToArray(bufferMatrices, mesh.instances.length * 16);
                    mesh.thinInstanceSetBuffer('matrix', bufferMatrices, 16, true);
                    const meshInstanceData = extras.ifc[mesh.name];
                    if (meshInstanceData) {
                        mesh.instanceIfcDataByGuid.set(mesh.name, meshInstanceData);
                    }
                    else {
                        console.error(`Mesh ${mesh.name} with ${mesh.instances.length} instances doesn't have any ifc data!`);
                    }
                    mesh.ifcType = meshInstanceData ? meshInstanceData.ifcType : firstIfcType;
                    mesh.ifcStorey = meshInstanceData ? meshInstanceData.ifcStorey : firstIfcStorey;
                    const filename = getIfcFilenameForInstances(ifcNames, meshInstanceData === null || meshInstanceData === void 0 ? void 0 : meshInstanceData.ifcFilename);
                    mesh.ifcFilename = filename ? filename : firstIfcFilename;
                    mesh.ifcId = (_a = ifcIdByFilename.get(mesh.ifcFilename)) !== null && _a !== void 0 ? _a : "";
                    mesh.instances.forEach(instance => {
                        instance.dispose();
                    });
                    mesh.parent = mergedMeshesNode;
                }
            });
            instancesRoot.dispose();
        }
        scene.meshes.forEach(mesh => {
            var _a;
            if (mesh.name !== 'navigationMesh' && mesh.name !== '__root__') {
                mesh.setParent(mergedMeshesNode);
                if (!mesh.hasThinInstances) {
                    const postProcessMeshData = extras.ifc[mesh.name];
                    if (postProcessMeshData) {
                        mesh.postProcessedMeshDatas = postProcessMeshData;
                        mesh.ifcType = postProcessMeshData[0].ifcType;
                        mesh.ifcStorey = postProcessMeshData[0].ifcStorey;
                        mesh.ifcFilename = postProcessMeshData[0].ifcFilename;
                        mesh.ifcId = (_a = ifcIdByFilename.get(postProcessMeshData[0].ifcFilename)) !== null && _a !== void 0 ? _a : "";
                    }
                    else {
                        console.error(`Mesh ${mesh.name} doesn't have any ifc data!`);
                    }
                }
            }
            mesh.isPickable = false;
            mesh.alwaysSelectAsActiveMesh = true;
            mesh.renderingGroupId = 1;
            mesh.useVertexColors = false;
            mesh.freezeWorldMatrix();
        });
        if (subTrackers)
            subTrackers.importModels.UpdateProgress(1);
        return mergedMeshesNode;
    });
}
/** Hotfix for incorrect file names passed to instances. There may be files that will rely on this in "the wild" */
const getIfcFilenameForInstances = (ifcNames, filename) => {
    if (filename && filename.includes('.gltf')) {
        return ifcNames.map(name => filename.includes(name) ? name + '.ifc' : undefined).filter(x => !!x)[0];
    }
    else {
        return filename;
    }
};
//# sourceMappingURL=GltfLoader.js.map