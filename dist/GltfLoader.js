import { __awaiter, __generator } from "tslib";
import '@babylonjs/core/Engines/engine';
import { FileTools, Mesh, SceneLoader, TransformNode, Vector3 } from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders';
import { uniq } from 'lodash';
import { EXT_mesh_gpu_instancing, ExtrasAsMetadata, GLTFLoader, KHR_materials_pbrSpecularGlossiness } from '@babylonjs/loaders/glTF/2.0';
/****
 * Override RequestFile to support progress on gzipped files with chrome
 * https://bugs.chromium.org/p/chromium/issues/detail?id=463622
 */
var requestFileBase = FileTools.RequestFile;
FileTools.RequestFile = function (url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError, onOpened) {
    var wrappedProgress = onProgress ? function (event) {
        var _a;
        var req = event.target;
        if (!event.lengthComputable && event.total === 0 && (req === null || req === void 0 ? void 0 : req.getResponseHeader('Content-Encoding')) === 'gzip') {
            // Multiply gltfContentLength so it is closer to the loaded length in Chrome.
            // TODO: Uncompressed size could be sent in custom header
            var reqTotal = parseInt((_a = req === null || req === void 0 ? void 0 : req.getResponseHeader('Content-Length')) !== null && _a !== void 0 ? _a : '4000000', 10) * 4;
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
 * @param {Scene} scene - The Babylon.js Scene to import meshes to.
 * @param {string[]} gltfFileUrls - Array of glTF file URLs to import.
 * @param {Map<string, string>} linkedFilesMap - Optional - Helps sub-tracker to calculate loading bar right. Default value is empty new Map().
 * @param {Map<string, string>} ifcIdByFilename - Optional - Adds meshes ifc model id. Default value is empty new Map().
 * @param {(vector: Vector3) => void} getModelOffset - Optional - void function passing model offset.
 * @param {any} subTrackers - Optional - This is used to handle loading phase.
 * @returns {Promise<TransformNode>} - The node in the Babylon.js Scene under which the imported meshes were added
 */
export function loadGltfFiles(scene, gltfFileUrls, linkedFilesMap, ifcIdByFilename, getModelOffset, subTrackers) {
    if (linkedFilesMap === void 0) { linkedFilesMap = new Map(); }
    if (ifcIdByFilename === void 0) { ifcIdByFilename = new Map(); }
    return __awaiter(this, void 0, void 0, function () {
        var parsed, linkedFilesSizeEstimate, mergedMeshesNode, extras, x, y, z, firstDataValue, firstIfcType, firstIfcStorey, firstIfcFilename, ifcNames, instancesRoot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    SceneLoader.RegisterPlugin(new GLTFFileLoader());
                    GLTFLoader.RegisterExtension("ExtrasAsMetadata", function (loader) { return new ExtrasAsMetadata(loader); });
                    GLTFLoader.RegisterExtension("KHR_materials_pbrSpecularGlossiness", function (loader) { return new KHR_materials_pbrSpecularGlossiness(loader); });
                    GLTFLoader.RegisterExtension("EXT_mesh_gpu_instancing", function (loader) { return new EXT_mesh_gpu_instancing(loader); });
                    parsed = false;
                    linkedFilesSizeEstimate = linkedFilesMap.size * 1024000000;
                    SceneLoader.OnPluginActivatedObservable.add(function (loader) {
                        if (loader.name === 'gltf') {
                            var gltf = loader;
                            gltf.validate = false; // with validation linked files are loaded twice
                            gltf.onParsed = function (ld) { parsed = true; };
                            gltf.preprocessUrlAsync = function (x) {
                                var _a;
                                var filename = x.substring(x.lastIndexOf('/') + 1);
                                var linked = (_a = linkedFilesMap.get(filename)) !== null && _a !== void 0 ? _a : "";
                                return Promise.resolve(linked);
                            };
                        }
                    });
                    SceneLoader.ShowLoadingScreen = false;
                    mergedMeshesNode = new TransformNode('MergedMeshes', scene);
                    return [4 /*yield*/, Promise.all(gltfFileUrls.map(function (url) { return SceneLoader.AppendAsync('', url, scene, function (progress) {
                            var totalProgress = parsed ? progress.total : progress.total + linkedFilesSizeEstimate;
                            if (subTrackers)
                                subTrackers.importModels.UpdateProgress((progress.loaded / totalProgress) * 1.05);
                        }); }))];
                case 1:
                    _a.sent();
                    extras = { centeringOffset: [], ifc: [] };
                    scene.transformNodes.forEach(function (node) {
                        if (node.metadata && node.metadata.gltf && node.metadata.gltf.extras) {
                            extras = node.metadata.gltf.extras;
                            node.dispose();
                        }
                    });
                    if (extras.centeringOffset && getModelOffset !== undefined) {
                        x = Number(extras.centeringOffset[0]);
                        y = Number(extras.centeringOffset[1]);
                        z = Number(extras.centeringOffset[2]);
                        getModelOffset(new Vector3(-x, y, z));
                    }
                    firstDataValue = Object.values(extras.ifc)[0];
                    firstIfcType = firstDataValue.ifcType;
                    firstIfcStorey = firstDataValue.ifcStorey;
                    firstIfcFilename = firstDataValue.ifcFilename;
                    ifcNames = scene.meshes.map(function (mesh) {
                        if (mesh.name !== 'navigationMesh' && mesh.name !== '__root__') {
                            if (!mesh.hasInstances) {
                                var postProcessMeshData = extras.ifc[mesh.name];
                                if (postProcessMeshData && postProcessMeshData[0]) {
                                    return postProcessMeshData[0].ifcFilename;
                                }
                            }
                        }
                    }).filter(function (x) { return !!x; });
                    ifcNames = uniq(ifcNames);
                    ifcNames = ifcNames.map(function (name) { return name.split('.ifc')[0]; });
                    instancesRoot = scene.getTransformNodeByName('instances');
                    if (instancesRoot) {
                        instancesRoot.getDescendants(false).map(function (node) {
                            var _a;
                            if (node instanceof Mesh && node.hasInstances) {
                                var mesh_1 = node;
                                mesh_1.name = mesh_1.name.split('_primitive')[0];
                                mesh_1.flipFaces(false);
                                var pivotMatrix_1 = mesh_1.getPivotMatrix();
                                var meshMatrix = mesh_1.computeWorldMatrix(true).multiply(pivotMatrix_1);
                                mesh_1.resetLocalMatrix(true);
                                var bufferMatrices_1 = new Float32Array(16 * (mesh_1.instances.length + 1));
                                mesh_1.instanceIfcDataByGuid = new Map();
                                mesh_1.instances.forEach(function (instance, index) {
                                    instance.name = instance.name.split('_primitive')[0];
                                    var instanceMatrix = instance.computeWorldMatrix(true).multiply(pivotMatrix_1);
                                    instanceMatrix.copyToArray(bufferMatrices_1, index * 16);
                                    var instanceIfcData = extras.ifc[instance.name];
                                    if (instanceIfcData)
                                        mesh_1.instanceIfcDataByGuid.set(instance.name, instanceIfcData);
                                    else
                                        console.error("Instance " + instance.name + " " + (index + 1) + " of " + mesh_1.instances.length + " doesn't have any ifc data!");
                                });
                                meshMatrix.copyToArray(bufferMatrices_1, mesh_1.instances.length * 16);
                                mesh_1.thinInstanceSetBuffer('matrix', bufferMatrices_1, 16, true);
                                var meshInstanceData = extras.ifc[mesh_1.name];
                                if (meshInstanceData)
                                    mesh_1.instanceIfcDataByGuid.set(mesh_1.name, meshInstanceData);
                                else
                                    console.error("Mesh " + mesh_1.name + " with " + mesh_1.instances.length + " instances doesn't have any ifc data!");
                                mesh_1.ifcType = meshInstanceData ? meshInstanceData.ifcType : firstIfcType;
                                mesh_1.ifcStorey = meshInstanceData ? meshInstanceData.ifcStorey : firstIfcStorey;
                                var filename = getIfcFilenameForInstances(ifcNames, meshInstanceData === null || meshInstanceData === void 0 ? void 0 : meshInstanceData.ifcFilename);
                                mesh_1.ifcFilename = filename ? filename : firstIfcFilename;
                                mesh_1.ifcId = (_a = ifcIdByFilename.get(mesh_1.ifcFilename)) !== null && _a !== void 0 ? _a : "";
                                mesh_1.instances.forEach(function (instance) {
                                    instance.dispose();
                                });
                                mesh_1.parent = mergedMeshesNode;
                            }
                        });
                        instancesRoot.dispose();
                    }
                    scene.meshes.forEach(function (mesh) {
                        var _a;
                        if (mesh.name !== 'navigationMesh' && mesh.name !== '__root__') {
                            mesh.setParent(mergedMeshesNode);
                            if (!mesh.hasThinInstances) {
                                var postProcessMeshData = extras.ifc[mesh.name];
                                if (postProcessMeshData) {
                                    mesh.postProcessedMeshDatas = postProcessMeshData;
                                    mesh.ifcType = postProcessMeshData[0].ifcType;
                                    mesh.ifcStorey = postProcessMeshData[0].ifcStorey;
                                    mesh.ifcFilename = postProcessMeshData[0].ifcFilename;
                                    mesh.ifcId = (_a = ifcIdByFilename.get(postProcessMeshData[0].ifcFilename)) !== null && _a !== void 0 ? _a : "";
                                }
                                else {
                                    console.error("Mesh " + mesh.name + " doesn't have any ifc data!");
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
                    return [2 /*return*/, mergedMeshesNode];
            }
        });
    });
}
/** Hotfix for incorrect file names passed to instances. There may be files that will rely on this in "the wild" */
var getIfcFilenameForInstances = function (ifcNames, filename) {
    if (filename && filename.includes('.gltf')) {
        return ifcNames.map(function (name) { return filename.includes(name) ? name + '.ifc' : undefined; }).filter(function (x) { return !!x; })[0];
    }
    else {
        return filename;
    }
};
//# sourceMappingURL=GltfLoader.js.map