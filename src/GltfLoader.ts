import '@babylonjs/core/Engines/engine';
import {
  Mesh,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders';
import { uniq } from 'lodash';
import {
  EXT_mesh_gpu_instancing,
  ExtrasAsMetadata,
  GLTFLoader,
  KHR_materials_pbrSpecularGlossiness
} from '@babylonjs/loaders/glTF/2.0';
import { PostProcessedInstanceData, PostProcessedMeshData } from "./Extensions/AbstractMeshExtensions";

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
export async function loadGltfFiles(scene: Scene, gltfFileUrls: string[], linkedFilesMap: Map<string, string> = new Map(), ifcIdByFilename: Map<string, string> = new Map(), getModelOffset?: (vector: Vector3) => void,  subTrackers?: any): Promise<TransformNode> {
  SceneLoader.RegisterPlugin(new GLTFFileLoader());
  GLTFLoader.RegisterExtension("ExtrasAsMetadata", (loader) => new ExtrasAsMetadata(loader));
  GLTFLoader.RegisterExtension("KHR_materials_pbrSpecularGlossiness", (loader) => new KHR_materials_pbrSpecularGlossiness(loader));
  GLTFLoader.RegisterExtension("EXT_mesh_gpu_instancing", (loader) => new EXT_mesh_gpu_instancing(loader));

  // Buffer binary files do not show in in progress total until they are requested
  // so an estimate of 1GB per file is used until the main file is parsed
  let parsed = false;
  const linkedFilesSizeEstimate = linkedFilesMap.size * 1024000000; // 1GB per file;

  SceneLoader.OnPluginActivatedObservable.add(function(loader) {
    if (loader.name === 'gltf') {
      const gltf = loader as GLTFFileLoader;
      gltf.validate = false; // with validation linked files are loaded twice
      gltf.onParsed = ld => { parsed = true; };

      gltf.preprocessUrlAsync = x =>  {
        const filename = x.substring(x.lastIndexOf('/') + 1);
        const linked = linkedFilesMap.get(filename) ?? "";

        return Promise.resolve(linked);
      };

      /****
       * Monkeypatch _onProgress to support progress on gzipped files with chrome
       * https://bugs.chromium.org/p/chromium/issues/detail?id=463622
       */
      // @ts-ignore
      const baseProgress = gltf._onProgress;
      // @ts-ignore
      gltf._onProgress =
          function (event, requestInfo) {
            const req = event.target as XMLHttpRequest;
            if (!event.lengthComputable && event.total === 0 && req?.getResponseHeader('Content-Encoding') === 'gzip') {
              // Multiply gltfContentLength so it is closer to the loaded length in Chrome.
              // TODO: Uncompressed size could be sent in custom header
              const reqTotal = parseInt(req?.getResponseHeader('Content-Length') ?? '4000000', 10) * 4;
              baseProgress.call(gltf, {
                loaded: event.loaded,
                lengthComputable: true,
                total: reqTotal,
                target: event.target,
              }, requestInfo);
            } else {
              baseProgress.call(gltf, event, requestInfo);
            }
          };
    }
  });

  SceneLoader.ShowLoadingScreen = false;

  const mergedMeshesNode = new TransformNode('MergedMeshes', scene);

  await Promise.all(gltfFileUrls.map(url => SceneLoader.AppendAsync('', url, scene, progress => {
    const totalProgress = parsed ? progress.total : progress.total  + linkedFilesSizeEstimate;

    if (subTrackers)
      subTrackers.importModels.UpdateProgress((progress.loaded / totalProgress) * 1.05);
  })));

  let extras: { centeringOffset: any, ifc: [] } = { centeringOffset: [], ifc: [] };

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

  const firstDataValue = Object.values(extras.ifc)[0] as PostProcessedMeshData;
  const firstIfcType = firstDataValue.ifcType;
  const firstIfcStorey = firstDataValue.ifcStorey;
  const firstIfcFilename = firstDataValue.ifcFilename;

  let ifcNames = scene.meshes.map(mesh => {
    if (mesh.name !== 'navigationMesh' && mesh.name !== '__root__') {
      if (!mesh.hasInstances) {
        const postProcessMeshData = extras.ifc[mesh.name as any] as PostProcessedMeshData[];

        if (postProcessMeshData && postProcessMeshData[0]) {
          return postProcessMeshData[0].ifcFilename;
        }
      }
    }
  }).filter(x => !!x);

  ifcNames = uniq(ifcNames);
  ifcNames = ifcNames.map(name => name!.split('.ifc')[0]);

  const instancesRoot = scene.getTransformNodeByName('instances');

  if (instancesRoot) {
    instancesRoot.getDescendants(false).map(node => {
      if (node instanceof Mesh && node.hasInstances) {
        const mesh = node as Mesh;
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

          const instanceIfcData = extras.ifc[instance.name as any] as PostProcessedInstanceData;

          if (instanceIfcData)
            mesh.instanceIfcDataByGuid!.set(instance.name, instanceIfcData);
          else
            console.error(`Instance ${instance.name} ${index + 1} of ${mesh.instances.length} doesn't have any ifc data!`);
        });

        meshMatrix.copyToArray(bufferMatrices, mesh.instances.length * 16);

        mesh.thinInstanceSetBuffer('matrix', bufferMatrices, 16, true);

        const meshInstanceData = extras.ifc[mesh.name as any] as PostProcessedInstanceData;

        if (meshInstanceData)
          mesh.instanceIfcDataByGuid!.set(mesh.name, meshInstanceData);
        else
          console.error(`Mesh ${mesh.name} with ${mesh.instances.length} instances doesn't have any ifc data!`);

        mesh.ifcType = meshInstanceData ? meshInstanceData.ifcType : firstIfcType;
        mesh.ifcStorey = meshInstanceData ? meshInstanceData.ifcStorey : firstIfcStorey;

        const filename = getIfcFilenameForInstances(ifcNames, meshInstanceData?.ifcFilename);
        mesh.ifcFilename = filename ? filename : firstIfcFilename;

        mesh.ifcId = ifcIdByFilename.get(mesh.ifcFilename) ?? "";

        mesh.instances.forEach(instance => {
          instance.dispose();
        });

        mesh.parent = mergedMeshesNode;
      }
    });

    instancesRoot.dispose();
  }

  scene.meshes.forEach(mesh => {
    if (mesh.name !== 'navigationMesh' && mesh.name !== '__root__') {
      mesh.setParent(mergedMeshesNode);

      if (!mesh.hasThinInstances) {
        const postProcessMeshData = extras.ifc[mesh.name as any] as PostProcessedMeshData[];

        if (postProcessMeshData) {
          mesh.postProcessedMeshDatas = postProcessMeshData;
          mesh.ifcType = postProcessMeshData[0].ifcType;
          mesh.ifcStorey = postProcessMeshData[0].ifcStorey;
          mesh.ifcFilename = postProcessMeshData[0].ifcFilename;
          mesh.ifcId = ifcIdByFilename.get(postProcessMeshData[0].ifcFilename) ?? "";
        } else {
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
}

/** Hotfix for incorrect file names passed to instances. There may be files that will rely on this in "the wild" */
const getIfcFilenameForInstances = (ifcNames: (string | undefined)[], filename: string) => {
  if (filename && filename.includes('.gltf')) {
    return ifcNames.map(name => filename.includes(name!) ? name + '.ifc' : undefined).filter(x => !!x)[0];
  } else {
    return filename;
  }
};
