import { ArcRotateCamera, SceneLoader, AbstractMesh, StandardMaterial, PBRMaterial, Mesh  } from '@babylonjs/core';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from "@babylonjs/core/Maths/math";


/**
 * Frame scene. First it calculates the radius of the entire scene.
 * Then it calculates this based on camera fov so that the entire building is visible in camera view.
 * Then it sets camera target to scene origin.
 * Then it moves the camera so that the model is in 45 degree angle from the model based on architure standards.
 * Then it sets camera radius
 * @param {Scene} scene - The Babylon scene to frame.
 * @param {ArcRotateCamera} orbitCamera - The orbit camera to frame.
 */
export function frameScene(scene: Scene|any, orbitCamera: ArcRotateCamera) {
    if (scene === undefined) {
        throw Error('Frame scene: scene is undefined!');
    }
    if (orbitCamera === undefined) {
        throw Error('Frame scene: orbitCamera is undefined!');
    }
    const r = getMaxBoundingDistanceFromOrigo(scene.meshes);
    const d = r / (Math.sin(orbitCamera.fov / 2));
    orbitCamera.setTarget(Vector3.Zero());
    orbitCamera.setPosition(new Vector3(-1, 0.9, -1));
    orbitCamera.radius = d;
    orbitCamera.lowerRadiusLimit = 1;
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

export function GetMeshesWithinAverageBoxCenterDeviation(meshes: AbstractMesh[]) {
    const boundingBoxCenters = meshes.map(x => ({center: x.getBoundingInfo().boundingBox.centerWorld, mesh: x}));
    const averagePosition = boundingBoxCenters.reduce((a, b) => a.add(b.center), Vector3.Zero()).divide(new Vector3(meshes.length, meshes.length, meshes.length));
    const averageDeviation = boundingBoxCenters.reduce((a, b) =>  a + Vector3.Distance(averagePosition, b.center) , 0) / meshes.length;
    const meshesWithinDeviation = boundingBoxCenters.filter(x => Vector3.Distance(averagePosition, x.center) <= averageDeviation).map(x => x.mesh);
    return meshesWithinDeviation.length > 0 ? meshesWithinDeviation : meshes;
}




export async function loadModel(scene: Scene, uid: string) {
    const myUrls = await fetchGltfUrls(uid);
    await myUrls.forEach(async (url: string) => {
      await SceneLoader.ImportMeshAsync("", "", url, scene, null, '.gltf').then((result: any) => {
        applyPbrMaterials(scene, result.meshes)
      });
  
    })
  }
  
  async function applyPbrMaterials(scene: Scene, meshes: Array<AbstractMesh>) {
    meshes.forEach((mesh: AbstractMesh) => {
      if (mesh.material) {
        const serialized = mesh.material.serialize();
        const newMat = StandardMaterial.Parse(serialized, scene, '')
        const meshmat = mesh.material as PBRMaterial
        newMat.diffuseColor = meshmat.albedoColor;
        const pbr = PBRMaterial.Parse(serialized, scene, '')
        pbr.twoSidedLighting = true;
  
        if(mesh.material instanceof PBRMaterial) {
          pbr.albedoColor = mesh.material.albedoColor;
          pbr.useAlphaFromAlbedoTexture = true;
          pbr.metallic = 0.5;
        }
  
        if(mesh instanceof Mesh) {
          mesh.material = pbr
        }
      }
    });
  
    return meshes;
  }
  
  async function fetchGltfUrls(tridifyIfcUID: string) {
    const gltfWithoutIfcSpaces = (url: string) => {
      var baseUrl = url.split('?')[0]
      return baseUrl.endsWith('.gltf') && !baseUrl.endsWith('IfcSpace.gltf')
    }
  
    const response = await fetch(`https://ws.tridify.com/api/shared/conversion/${tridifyIfcUID}`);
    return await response.json().then((data: any) => (
      data.ColladaUrls.filter((x: string) => x.split('?')[0].endsWith('.gltf')).filter(gltfWithoutIfcSpaces)
    ));
  }


  export function createOrbitCamera(targetScene: Scene) {
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
