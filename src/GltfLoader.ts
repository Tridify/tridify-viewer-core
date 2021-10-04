import '@babylonjs/core/Engines/engine';
import {
  Scene,
  SceneLoader,
  PBRMaterial,
  Mesh,
  TransformNode,
  Vector3,
  Nullable,
  Material,
  FileTools,
  WebRequest,
  IOfflineProvider,
  RequestFileError,
  IFileRequest
} from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders';
import { uniq } from 'lodash';
import { ExtrasAsMetadata, EXT_mesh_gpu_instancing, GLTFLoader, KHR_materials_pbrSpecularGlossiness } from '@babylonjs/loaders/glTF/2.0';
// import { TridifyPbrMaterial } from './TridifyMaterials/tridifyMaterial';
  

  declare module '@babylonjs/core/Meshes/abstractMesh.js' {
    interface AbstractMesh {
      ifcType: string;
      PostProcessedMeshDatas: PostProcessedMeshData[];
    }
  }

  interface PostProcessedMeshData {
    ifcGuid: string;
    ifcType: string;
    ifcStorey: string;
    ifcFilename: string;
    startVertex: number;
    endVertex: number;
    startIndex: number;
    endIndex: number;
  }

  interface PostProcessedInstanceData {
    ifcFilename: string;
    ifcStorey: string;
    ifcType: string;
  }

  interface PostProcessedMeshData {
    ifcGuid: string;
    ifcType: string;
    ifcStorey: string;
    ifcFilename: string;
    startVertex: number;
    endVertex: number;
    startIndex: number;
    endIndex: number;
  }

  declare module '@babylonjs/core/Meshes/abstractMesh.js' {
    interface AbstractMesh {
      /** the id of the IFC file that this mesh is from */
      ifcId?: string;
      /** the ifc floor associated with this mesh */
      ifcStorey?: string;
      /** the ifc type associated with this mesh */
      ifcType: string;
      /** the bimIndex number that signifies the ifc data of this mesh as well as its vertex color *see BimTool.ts */
      bimDataIndex: number;
      /** if this mesh has instances. These are their bimIndices */
      instanceBimIndices?: number[];
      /** if this mesh has instances. These are their ifc guids */
      instanceIfcDataByGuid?: Map<string, PostProcessedInstanceData>;
      /** if mesh is composed of merged meshes, This dictionary contains the data needed to recreate original meshes for each bimIndex *see BimVertexHandler.ts */
      bimIndexPositionsMap: Map<number, Array<{ startVertex: number, endVertex: number, startIndex: number, endIndex: number }>>;
      /** temporary placeholder for material if needed to be switched for custom rendering */
      savedMaterial: Nullable<Material>;
      /** The name of the ifc file that this mesh is from */
      ifcFilename: string;
      /** array of extra gltf data concerning this mesh */
      postProcessedMeshDatas?: PostProcessedMeshData[];
    }
  }

  let ifcNames: Array<string | undefined>;

/****
 * Override RequestFile to support progress on gzipped files with chrome
 * https://bugs.chromium.org/p/chromium/issues/detail?id=463622
 */
const requestFileBase = FileTools.RequestFile;

FileTools.RequestFile = (url: string, onSuccess: (data: string | ArrayBuffer, request?: WebRequest) => void, onProgress?: (event: ProgressEvent) => void, offlineProvider?: IOfflineProvider, useArrayBuffer?: boolean, onError?: (error: RequestFileError) => void, onOpened?: (request: WebRequest) => void): IFileRequest => {
  const wrappedProgress = onProgress ? (event: ProgressEvent) => {
    const req = event.target as XMLHttpRequest;
    if (!event.lengthComputable && event.total === 0 && req?.getResponseHeader('Content-Encoding') === 'gzip') {
        // Multiply gltfContentLength so it is closer to the loaded length in Chrome.
        // uncompressed size could be sent in custom header
      const reqTotal = parseInt(req?.getResponseHeader('Content-Length') ?? '4000000', 10) * 4;
      onProgress({
        loaded: event.loaded,
        lengthComputable: true,
        total: reqTotal,
        target: event.target,
      } as ProgressEvent);
    } else {
      onProgress(event);
    }
  } : undefined;
  return requestFileBase(url, onSuccess, wrappedProgress, offlineProvider, useArrayBuffer, onError, onOpened);
};



/**
 * Import Tridify Models with IFC data added into meshes.
 * @param {Scene} scene - The Babylon scene to import meshes.
 * @param {string[]} allGltfFiles - Array Model urls to import.
 * @param {AbstractMesh[]} linkedFilesMap - Optional - Helps subtracker to calculate loading bar right. Default value is empty new Map().
 * @param {AbstractMesh[]} ifcIdByFilename - Optional - Adds meshes ifc model id. Default value is empty new Map().
 * @param {(vector: Vector3) => void} getModelOffset - Optional - void function passing model offset.
 * @param {any} subTrackers - Optional - This is used to handle loading phase.
 */
export async function loadTridifyMeshGltf(scene: Scene, allGltfFiles: string[], linkedFilesMap: Map<string, string> = new Map(), ifcIdByFilename: Map<string, string> = new Map(), getModelOffset?: (vector: Vector3) => void, tridifyMat?: any,  subTrackers?: any): Promise<TransformNode> {
  SceneLoader.RegisterPlugin(new GLTFFileLoader());
  GLTFLoader.RegisterExtension("ExtrasAsMetadata", (loader) => new ExtrasAsMetadata(loader));
  GLTFLoader.RegisterExtension("KHR_materials_pbrSpecularGlossiness", (loader) => new KHR_materials_pbrSpecularGlossiness(loader));
  GLTFLoader.RegisterExtension("EXT_mesh_gpu_instancing", (loader) => new EXT_mesh_gpu_instancing(loader));
  //TODO: add tridify to loader so people can use their own materials
  //if(tridifyMat) GLTFLoader.RegisterExtension("TridifyMaterialLoader", (loader) => new TridifyMaterialLoader(loader, tridifyMat));
  //GLTFLoader.RegisterExtension("TridifyMaterialLoader", (loader) => new TridifyMaterialLoader(loader));

  // Buffer binary files do not show in in progress total until they are requested
  // so an estimate of 1GB per file is used until the main file is parsed
  let parsed = false;
  const linkedFilesSizeEstimate = linkedFilesMap.size * 1024000000; // 1GB per file;

  SceneLoader.OnPluginActivatedObservable.add(function(loader) {
    if (loader.name === 'gltf') {
      const gltf = loader as GLTFFileLoader;
      gltf.validate = false; // with validation linked files are loaded twice
      gltf.onParsed = ld => {parsed = true; };
      gltf.preprocessUrlAsync = x =>  {
        const filename = x.substring(x.lastIndexOf('/') + 1);
        const linked = linkedFilesMap.get(filename) ?? "";
        return Promise.resolve(linked);
      };
    }
  });

  SceneLoader.ShowLoadingScreen = false;

  const mergedMeshesNode = new TransformNode('MergedMeshes', scene);

  await Promise.all(allGltfFiles.map(url => SceneLoader.AppendAsync('', url, scene, progress => {
    const totalProgress = parsed ? progress.total : progress.total  + linkedFilesSizeEstimate;
    if(subTrackers) subTrackers.importModels.UpdateProgress((progress.loaded / totalProgress) * 1.05);
  }, ".glb")));

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
    getModelOffset(new Vector3(-x, y, z))
  }

  const firstDataValue = Object.values(extras.ifc)[0] as PostProcessedMeshData;
  const firstIfcType = firstDataValue.ifcType;
  const firstIfcStorey = firstDataValue.ifcStorey;
  const firstIfcFilename = firstDataValue.ifcFilename;

  ifcNames = scene.meshes.map(mesh => {
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
          if (instanceIfcData) mesh.instanceIfcDataByGuid!.set(instance.name, instanceIfcData);
          else { console.error(`Instance ${instance.name} ${index + 1} of ${mesh.instances.length} doesn't have any ifc data!`); }
        });

        meshMatrix.copyToArray(bufferMatrices, mesh.instances.length * 16);

        mesh.thinInstanceSetBuffer('matrix', bufferMatrices, 16, true);

        const meshInstanceData = extras.ifc[mesh.name as any] as PostProcessedInstanceData;
        if (meshInstanceData) {
          mesh.instanceIfcDataByGuid!.set(mesh.name, meshInstanceData);
        } else {
          console.error(`Mesh ${mesh.name} with ${mesh.instances.length} instances doesn't have any ifc data!`);
        }

        mesh.ifcType = meshInstanceData ? meshInstanceData.ifcType : firstIfcType;
        mesh.ifcStorey = meshInstanceData ? meshInstanceData.ifcStorey : firstIfcStorey;

        const filename = getIfcFilenameForInstances(meshInstanceData?.ifcFilename);
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

  // TODO: Create material copies on demand when wanting to turn a custom shader feature on for certain mesh(es)
  scene.materials.forEach(material => {
    material.getBindedMeshes().forEach((mesh, index) => {
      const mat = material.clone(material.id + '_' + index.toString().padStart(3, '0'));
      /*const specularColor = mat.reflectivityColor;
      // HACK: Override default specular of 0.5 generated during mesh post-processing as it makes materials unnatural
      // TODO: This can be removed after post-processor has more sensible defaults and we expect that old links that had the 0.5 default do not exist or are not used anymore
      if (Math.abs(specularColor.r - 0.5) < 0.0001 && Math.abs(specularColor.g - 0.5) < 0.0001 && Math.abs(specularColor.b - 0.5) < 0.0001) {
        specularColor.r = 0.05;
        specularColor.g = 0.05;
        specularColor.b = 0.05;
        mat.reflectivityColor = specularColor;
      }*/

      mesh.material = mat;
    });
  });

  if(subTrackers) subTrackers.importModels.UpdateProgress(1);

  return mergedMeshesNode;
}

/** Hotfix for incorrect file names passed to instances. There may be files that will rely on this in "the wild" */
const getIfcFilenameForInstances = (filename: string) => {
  if (filename && filename.includes('.gltf')) {
    const corrected = ifcNames.map(name => filename.includes(name!) ? name + '.ifc' : undefined).filter(x => !!x)[0];
    return corrected;
  } else {
    return filename;
  }
};


/*function TridifyMaterialLoader(this, loader, tridifyMaterial) {
  this.name = 'TridifyMaterialLoader';
  this.enabled = true;
  this.materialcreator = tridifyMaterial;

  this.createMaterial = function(context, material, babylonDrawMode) {
    //material = new TridifyPbrMaterial(material.name, loader.babylonScene);
    material = this.materialcreator(material.name, loader.babylonScene);
    material.sideOrientation = Material.CounterClockWiseSideOrientation;
    if (material.alpha < 1.0) {
      material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    }

    return material;
  };
}
function TridifyMaterialLoader(this, loader) {
  this.name = 'TridifyMaterialLoader';
  this.enabled = true;

  this.createMaterial = function(context, material, babylonDrawMode) {
    material = new TridifyPbrMaterial(material.name, loader.babylonScene);
    material.sideOrientation = Material.CounterClockWiseSideOrientation;
    if (material.alpha < 1.0) {
      material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    }

    return material;
  };
}*/