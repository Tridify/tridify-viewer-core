import '@babylonjs/core/Engines/engine';
import {
  ArcRotateCamera,
  Scene,
  SceneLoader,
  StandardMaterial,
  PBRMaterial,
  AbstractMesh,
  Mesh,
  Vector3
} from '@babylonjs/core';

import "@babylonjs/loaders/glTF/2.0"

/**
 * Frame scene. First it calculates the radius of the entire scene.
 * Then it calculates this based on camera fov so that the entire building is visible in camera view.
 * Then it sets camera target to scene origin.
 * Then it moves the camera so that the model is in 45 degree angle from the model based on architecture standards.
 * Then it sets camera radius
 * Then creates collision box if meshToFrame is give
 * @param {Scene} scene - The Babylon scene to frame.
 * @param {ArcRotateCamera} orbitCamera - Optional - The orbit camera to frame. If missing, use scene active camera
 * @param {AbstractMesh[]} meshesToFrame - Optional - meshes to use for framing. If missing use all in scene.
 * @param {number} minOrbitZoom - Optional - the minimum distance that the camera can zoom to to the center of the model. If missing, third of diameter.
 */
export function frameScene(scene: Scene, orbitCamera?: ArcRotateCamera, meshesToFrame?: AbstractMesh[], collisionMesh?: AbstractMesh, minOrbitZoom?: number) {

  if (orbitCamera === undefined) {
    try {
      orbitCamera = scene.activeCamera as ArcRotateCamera;
    } catch {
      throw Error('Frame scene: active scene camera is not an ArcRotateCamera');
    }
  }

  const r = getMaxBoundingDistanceFromOrigo(meshesToFrame !== undefined ? meshesToFrame : scene.meshes);
  const d = r / (Math.sin(orbitCamera.fov / 2));
  const divisor = 1.5;
  orbitCamera.setTarget(Vector3.Zero());
  orbitCamera.setPosition(new Vector3(-1 * d / divisor, 0.9 * d / divisor, -1 * d / divisor));

  if (collisionMesh) {
    orbitCamera.collisionRadius = new Vector3(8, 8, 8);
    collisionMesh.checkCollisions = true;
    collisionMesh.scaling = new Vector3(2, 2, 2);
    collisionMesh.isPickable = false;
    collisionMesh.isVisible = false;
    scene.collisionsEnabled = true;
  } else {
    orbitCamera.lowerRadiusLimit = minOrbitZoom !== undefined ? minOrbitZoom : (d / 3);
  }
}

/**
 * Get bounding distance.
 * @param {Scene} scene - The Babylon scene to frame.
 * @param {ArcRotateCamera} orbitCamera - The orbit camera to frame.
 * @returns {number} - The bounding distance from origo.
 */
export function getMaxBoundingDistanceFromOrigo(meshes: AbstractMesh[]): number {
  return Math.max(...GetMeshesWithinAverageBoxCenterDeviation(meshes)
    .map(x => x.getBoundingInfo().boundingSphere.radius + Vector3.Distance(x.absolutePosition, Vector3.Zero())));
}

/**
 * Load model based from a Tridify model hash
 * @param {Scene} scene - The Babylon scene to import model into.
 * @param {string} uid - The Tridify model hash.
 */
export async function loadModel(scene: Scene, uid: string): Promise<string[]> {
  const myUrls = await fetchGltfUrls(uid);
  if (myUrls && myUrls.files) {
    await myUrls.files.forEach(async (x) => {
      await SceneLoader.ImportMeshAsync("", "", x.Url, scene, null, '.gltf').then((result: any) => {
        const meshes: AbstractMesh[] = result.meshes;
        applyPbrMaterials(scene, meshes);
        meshes.forEach(mesh => mesh.ifcType = x.Type);
      });
    });
  }
  return myUrls.hash;
}

/**
* Center the imported meshes based on a standard deviation distance from each other
* @param {AbstractMesh[]} meshesToCenter - An array of meshes to center by
* @param {AbstractMesh[]} allMeshes - All meshes
* @returns {Vector3} - the vector to offset all meshes by
*/
export function centerModel(meshesToCenter: AbstractMesh[], allMeshes: AbstractMesh[]): Vector3 {
  const meshesWithinDeviation = GetMeshesWithinAverageBoxCenterDeviation(meshesToCenter);
  const offset = meshesWithinDeviation.map(x => x.getBoundingInfo().boundingBox.centerWorld)
    .reduce((a, b) => a.add(b))
    .divide(new Vector3(meshesWithinDeviation.length, meshesWithinDeviation.length, meshesWithinDeviation.length));
  allMeshes.forEach(x => x.setAbsolutePosition(x.absolutePosition.subtract(offset)));
  return offset;
}

/**
* Add a ArcRotateCamera to the scene with IFC based settings
* @param {Scene} scene - The current Babylon scene
* @returns {ArcRotateCamera} - a Babylon ArcRotateCamera
*/
export function createOrbitCamera(targetScene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera('ArcRotateCamera', 0, -Math.PI / 2, 0, Vector3.Zero(), targetScene, true);
  let cameraRadius = 0;
  camera.wheelDeltaPercentage = 0.005;
  targetScene.onBeforeRenderObservable.add(() => {
    if (cameraRadius === camera.radius) return;
    cameraRadius = camera.radius;
    camera.minZ = cameraRadius / 10;
  });
  camera.lowerRadiusLimit = 1;
  camera.panningSensibility = 100;
  return camera;
}

function GetMeshesWithinAverageBoxCenterDeviation(meshes: AbstractMesh[]) {
  const boundingBoxCenters = meshes.map(x => ({ center: x.getBoundingInfo().boundingBox.centerWorld, mesh: x }));
  const averagePosition = boundingBoxCenters.reduce((a, b) => a.add(b.center), Vector3.Zero()).divide(new Vector3(meshes.length, meshes.length, meshes.length));
  const averageDeviation = boundingBoxCenters.reduce((a, b) => a + Vector3.Distance(averagePosition, b.center), 0) / meshes.length;
  const meshesWithinDeviation = boundingBoxCenters.filter(x => Vector3.Distance(averagePosition, x.center) <= averageDeviation).map(x => x.mesh);
  return meshesWithinDeviation.length > 0 ? meshesWithinDeviation : meshes;
}

/**
* Load model based from a Tridify model hash
* @param {Scene} scene - The current Babylon scene
* @param {Array<AbstractMesh>} uid - An array of meshes to apply PBR materials to
*/
async function applyPbrMaterials(scene: Scene, meshes: Array<AbstractMesh>) {
  meshes.forEach((mesh: AbstractMesh) => {
    if (mesh.material) {
      const serialized = mesh.material.serialize();
      const newMat = StandardMaterial.Parse(serialized, scene, '')
      const meshmat = mesh.material as PBRMaterial
      newMat.diffuseColor = meshmat.albedoColor;
      const pbr = PBRMaterial.Parse(serialized, scene, '')
      pbr.twoSidedLighting = true;

      if (mesh.material instanceof PBRMaterial) {
        pbr.albedoColor = mesh.material.albedoColor;
        pbr.useAlphaFromAlbedoTexture = true;
        pbr.metallic = 0;
      }

      if (mesh instanceof Mesh) {
        mesh.material = pbr
      }
    }
  });

  return meshes;
}

async function fetchGltfUrls(tridifyIfcUID: string): Promise<{ files: SharedConversionFileDTO[], hash: string[] }> {
  const baseUrl: string = 'https://ws.tridify.com/api';
  //old conversion
  const legacyFetch = () => fetch(`${baseUrl}/shared/conversion/${tridifyIfcUID}`)
    .then(response => response.json())
    .then((responseData) => {
      const gltfUrls = responseData.ColladaUrls.filter((x: string) => x.split('?')[0].endsWith('.gltf')) as string[];
      const newGltfUrlFiles: SharedConversionFileDTO[] = [];
      gltfUrls.forEach(x => {
        const parsedUrl: string[] = x.split('.gltf')[0].split('_');
        const part = parsedUrl.pop();
        const UrlType = part?.includes('part') ? parsedUrl.pop() as string : part as string;
        const UrlStorey = parsedUrl.pop() as string;
        const UrlStoreyLevel = parsedUrl.pop() as string;
        const GltfUrlFile: SharedConversionFileDTO = { Url: x, Type: UrlType, Format: '.gltf', Storey: !UrlStoreyLevel.includes('Tridify') ? UrlStoreyLevel + UrlStorey : UrlStorey };
        newGltfUrlFiles.push(GltfUrlFile);
      });
      return { files: newGltfUrlFiles, hash: [tridifyIfcUID] };
    });
  return fetch(`${baseUrl}/v1/published-links/${tridifyIfcUID}`, { mode: 'cors' })
    .then(response => {
      if (response.ok)
        return response.json()
          .then((responseData: SharedConversionsDTO) => {
            const files = responseData.Conversions
              .flatMap(x => x.Files)
              .filter(x => x.Format === '.gltf')
              .map(x => x) as SharedConversionFileDTO[];
            return { files: files, hash: responseData.Conversions.flatMap(x => x.Hash) };
          });
      return legacyFetch();
    }).catch(x => legacyFetch());
}

interface SharedConversionsDTO {
  Conversions: SharedConversionDTO[];
}

interface SharedConversionDTO {
  Hash: string;
  Files: SharedConversionFileDTO[];
}

interface SharedConversionFileDTO {
  Url: string;
  Type: string;
  Format: string;
  Storey: string;
}

declare module '@babylonjs/core/Meshes/abstractMesh.js' {
  interface AbstractMesh {
    ifcType: string;
  }
}

/**
* Load Ifc data object
* @param {string} uid - conversionID.
* @param {string} property - Optional - property to load properties under ifc object.
*/
export async function loadIfc(uids: string[], property: string = "") {
  const baseUrl = 'https://ws.tridify.com/api';
  const promiseArray = uids.map(x => fetch(`${baseUrl}/shared/conversion/${x}/ifc/${property}`, { mode: 'cors' })
    .then(response => {
      return response.json();
    }).catch(() => {
      console.log('Ifc not found ', x);
      return [];
    })
  );
  return Promise.all(promiseArray);
}



