export interface PublishedLinkDTO {
  Conversions: SharedConversionDTO[];
  Configuration: SharedConfigurationDTO;
  LinkEnabled: boolean;
  PostProcessState: string; // TODO: Change to enum
  PostProcessedFiles: string[];
  LinkedFiles: LinkedFileDTO[];
}

export interface SharedConversionDTO {
  Hash: string;
  Files: SharedConversionFileDTO[];
  FileName: string;
}

export interface SharedConversionFileDTO {
  Url: string;
  Type: string;
  Format: string;
  Storey: string;
  Overlay: boolean;
  Guid: string;
  FileName: string | undefined; // undefined for old conversions
}

export interface SharedConfigurationDTO {
  Tools: ToolsDTO;
  PropertySetNames: string[];
  QuantityNames: string[];
}

export interface ToolsDTO {
  VRHeadsetMode: boolean;
  ShareViewer: boolean;
  MeasureTool: boolean;
  BimTool: boolean;
  CuttingPlanesTool: boolean;
  WaypointTool: boolean;
  CombinationVisibilityTool: boolean;
  CommentingTool: boolean;
  LocationTool: boolean;
}

export interface LinkedFileDTO {
  OriginalFileName: string;
  Url: string;
}

export interface MaterialLibraryDTO {
  asset: { version: string, generator: string };
  images: [{ uri: string, name: string }];
  samplers: [{ magFilter: number, minFilter: number }];
  textures: [{ source: number, sampler: number }];
  materials: any[];
}

export interface ObjectPropertySetsDTO {
  PropertySets: any[];
  TypeDefinedPropertySets: any[];
}

export interface IfcHierarchyDTO {
  FileName: string;
  IfcProject: any;
}
