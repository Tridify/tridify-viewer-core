import { IInspectable, InspectableType } from '@babylonjs/core/Misc/iInspectable';

export const TridifyPbrMaterialInspectableProperties: IInspectable[] = [
  {
    label: 'Direct Light Intensity',
    propertyName: 'directIntensity',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    label: 'Emissive Intensity',
    propertyName: 'emissiveIntensity',
    type: InspectableType.Slider,
    min: 0,
    max: 10,
    step: 0.01,
  },
  {
    label: 'Environment Intensity',
    propertyName: 'environmentIntensity',
    type: InspectableType.Slider,
    min: 0,
    max: 5,
    step: 0.01,
  },
  {
    label: 'Specular Intensity',
    propertyName: 'specularIntensity',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    label: 'Disable Bump Map',
    propertyName: 'disableBumpMap',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Metallic Value',
    propertyName: 'metallic',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    label: 'Roughness Value',
    propertyName: 'roughness',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.01,
  },
  /**
   * In metallic workflow, specifies an F0 factor to help configuring the material F0.
   * By default the indexOfrefraction is used to compute F0;
   *
   * This is used as a factor against the default reflectance at normal incidence to tweak it.
   *
   * F0 = defaultF0 * metallicF0Factor * metallicReflectanceColor;
   * F90 = metallicReflectanceColor;
   */
  {
    label: 'F0 Factor',
    propertyName: 'metallicF0Factor',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.001,
  },
  /**
   * In metallic workflow, specifies an F90 color to help configuring the material F90.
   * By default the F90 is always 1;
   *
   * Please note that this factor is also used as a factor against the default reflectance at normal incidence.
   *
   * F0 = defaultF0 * metallicF0Factor * metallicReflectanceColor
   * F90 = metallicReflectanceColor;
   */
  {
    label: 'Metallic Reflectance Color',
    propertyName: 'metallicReflectanceColor',
    type: InspectableType.Color3,
  },
  {
    label: 'Ambient Color',
    propertyName: 'ambientColor',
    type: InspectableType.Color3,
  },
  {
    label: 'Albedo Color',
    propertyName: 'albedoColor',
    type: InspectableType.Color3,
  },
  {
    label: 'Reflectivity Color',
    propertyName: 'reflectivityColor',
    type: InspectableType.Color3,
  },
  {
    label: 'Reflection Color',
    propertyName: 'reflectionColor',
    type: InspectableType.Color3,
  },
  {
    label: 'Emissive Color',
    propertyName: 'emissiveColor',
    type: InspectableType.Color3,
  },
  {
    label: 'Glossiness',
    propertyName: 'microSurface',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.01,
  },
  /**
   * Index of refraction of the material base layer.
   * https://en.wikipedia.org/wiki/List_of_refractive_indices
   *
   * This does not only impact refraction but also the Base F0 of Dielectric Materials.
   *
   * From dielectric fresnel rules: F0 = square((iorT - iorI) / (iorT + iorI))
   */
  {
    label: 'Index Of Refraction',
    propertyName: 'indexOfRefraction',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.001,
  },
  {
    label: 'Invert Refraction Y',
    propertyName: 'invertRefractionY',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Link Refraction With Transparency',
    propertyName: 'linkRefractionWithTransparency',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Lightmap As Shadowmap',
    propertyName: 'useLightmapAsShadowmap',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Alpha From Albedo Texture',
    propertyName: 'useAlphaFromAlbedoTexture',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Force Alpha Test',
    propertyName: 'forceAlphaTest',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Alpha CutOff',
    propertyName: 'alphaCutOff',
    type: InspectableType.Slider,
    min: 0,
    max: 1,
    step: 0.001,
  },
  {
    label: 'Use Specular Over Alpha',
    propertyName: 'useSpecularOverAlpha',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Glossiness From Reflectivity Map Alpha',
    propertyName: 'useMicroSurfaceFromReflectivityMapAlpha',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Roughness From Metallic Texture Alpha',
    propertyName: 'useRoughnessFromMetallicTextureAlpha',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Roughness From Metallic Texture Green',
    propertyName: 'useRoughnessFromMetallicTextureGreen',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Metalness From Metallic Texture Blue',
    propertyName: 'useMetallnessFromMetallicTextureBlue',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Ambient Occlusion From Metallic Texture Red',
    propertyName: 'useAmbientOcclusionFromMetallicTextureRed',
    type: InspectableType.Checkbox,
  },
  /**
   * Specifies if the ambient texture contains the ambient occlusion information in its red channel only.
   */
  {
    label: 'Use Ambient Occlusion In GrayScale',
    propertyName: 'useAmbientInGrayScale',
    type: InspectableType.Checkbox,
  },
  /**
   * In case the reflectivity map does not contain the microsurface information in its alpha channel,
   * The material will try to infer what glossiness each pixel should be.
   */
  {
    label: 'Use Auto-Glossiness From Reflectivity Map',
    propertyName: 'useAutoMicroSurfaceFromReflectivityMap',
    type: InspectableType.Checkbox,
  },
  /**
   * Specifies that the material will keeps the reflection highlights over a transparent surface (only the most limunous ones).
   * A car glass is a good exemple of that. When the street lights reflects on it you can not see what is behind.
   */
  {
    label: 'Keep Reflection Highlights Over Transparent Surface',
    propertyName: 'useRadianceOverAlpha',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Use Object Space Normal Map',
    propertyName: 'useObjectSpaceNormalMap',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Allow Bump Map in Parallax Mode',
    propertyName: 'useParallax',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Allow Bump Map in Parallax Occlusion Mode',
    propertyName: 'useParallaxOcclusion',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Parallax Scale Bias',
    propertyName: 'parallaxScaleBias',
    type: InspectableType.Slider,
    min: 0,
    max: 0.2,
    step: 0.001,
  },
  {
    label: 'Force Irradiance In Fragment Shader',
    propertyName: 'forceIrradianceInFragment',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Max Allowed Simultaneous Lights',
    propertyName: 'maxSimultaneousLights',
    type: InspectableType.Slider,
    min: 0,
    max: 4,
    step: 1,
  },
  {
    label: 'Invert Normal Map X',
    propertyName: 'invertNormalMapX',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Invert Normal Map Y',
    propertyName: 'invertNormalMapY',
    type: InspectableType.Checkbox,
  },
  /**
   * If set to true and backfaceCulling is false, normals will be flipped on the backside.
   */
  {
    label: 'Enable Two-Sided Lighting',
    propertyName: 'twoSidedLighting',
    type: InspectableType.Checkbox,
  },
  /**
   * A fresnel is applied to the alpha of the model to ensure grazing angles edges are not alpha tested.
   * And/Or occlude the blended part. (alpha is converted to gamma to compute the fresnel)
   */
  {
    label: 'Use Alpha Fresnel',
    propertyName: 'useAlphaFresnel',
    type: InspectableType.Checkbox,
  },
  /**
   * A fresnel is applied to the alpha of the model to ensure grazing angles edges are not alpha tested.
   * And/Or occlude the blended part. (alpha stays linear to compute the fresnel)
   */
  {
    label: 'Use Linear Alpha Fresnel',
    propertyName: 'useLinearAlphaFresnel',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Force Normals Forward',
    propertyName: 'forceNormalForward',
    type: InspectableType.Checkbox,
  },
  /**
   * Enables specular anti aliasing in the PBR shader.
   * It will both interacts on the Geometry for analytical and IBL lighting.
   * It also prefilter the roughness map based on the bump values.
   */
  {
    label: 'Enable Specular Anti-Aliasing',
    propertyName: 'enableSpecularAntiAliasing',
    type: InspectableType.Checkbox,
  },
  /**
   * This parameters will enable/disable Horizon occlusion to prevent normal maps to look shiny when the normal
   * makes the reflect vector face the model (under horizon).
   */
  {
    label: 'Enable Horizon Occlusion',
    propertyName: 'useHorizonOcclusion',
    type: InspectableType.Checkbox,
  },
  /**
   * This parameters will enable/disable radiance occlusion by preventing the radiance to lit
   * too much the area relying on ambient texture to define their ambient occlusion.
   */
  {
    label: 'Enable Radiance Occlusion',
    propertyName: 'useRadianceOcclusion',
    type: InspectableType.Checkbox,
  },
  {
    label: 'Unlit',
    propertyName: 'unlit',
    type: InspectableType.Checkbox,
  },
];
