import { Material, Nullable } from "@babylonjs/core";

export interface PostProcessedMeshData {
  ifcGuid: string;
  ifcType: string;
  ifcStorey: string;
  ifcFilename: string;
  startVertex: number;
  endVertex: number;
  startIndex: number;
  endIndex: number;
}

export interface PostProcessedInstanceData {
  ifcFilename: string;
  ifcStorey: string;
  ifcType: string;
}

declare module '@babylonjs/core/Meshes/abstractMesh' {
  export interface AbstractMesh {
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
