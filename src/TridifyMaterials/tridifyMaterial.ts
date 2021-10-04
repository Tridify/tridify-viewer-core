// Blue-noise texture from Christoph Peters http://momentsingraphics.de/BlueNoise.html Creative Commons CC0 Public Domain Dedication
import { Scene, PBRMaterial, Effect, Nullable, SerializationHelper, BaseTexture, Texture, Color4, VertexBuffer, Constants, MaterialDefines, Material, RawTexture } from '@babylonjs/core';
import { onChangeToOrbitMode, onChangeToFreeMode, onAfterCameraStoppedMoving } from '../CameraUtils/cameraUtils';
import { TridifyPbrMaterialInspectableProperties } from '../TridifyPbrMaterialInspectableProperties';
import { IInspectable } from '@babylonjs/core/Misc/iInspectable';

/**
 * A PBR material that has the following modifications:
 *
 * If 'shouldFadeByProximity' is set to true, the material dither-fades when approached by the camera.
 *
 */
export class TridifyPbrMaterial extends PBRMaterial {
  //#region Properties
  /** the distance at which the material starts to fade from opaque to transparent, in meters */
  public static readonly distanceToStartFade = 3;

  /** the lowest possible fade value to show with proximity blue noise fading. 0 is fully transparent. 1 is fully opaque */
  public static readonly lowestProximityAlpha = Math.clamp(0.4, 0, 1);
  private static blueNoiseTexture: Nullable<BaseTexture> = null;

  private static defaultReplacementColor: Color4 = new Color4(1, 0, 1, 1);

  private bimIndicesReplacementTexture: Nullable<RawTexture> = null;

  private bimColorsToReplaceTotal: number = 0;

  private singleReplacementColor: Nullable<Color4> = null;

  private bimIndicesOpacityTexture: Nullable<RawTexture> = null;

  private newOpacitiesTexture: Nullable<RawTexture> = null;

  private singleOpacity: number | boolean = false; // shader define

  private bimIndicesToChangeOpacityTotal: number | boolean = false; // shader define

  private defaultVisibility: boolean = true;

  private fadeByProximity: boolean = false;

  public canFadeByProximity = false;

  private isCurrentlyBimIndexBlendingField = false;

  public get isCurrentlyBimIndexBlending(): boolean {
    return this.isCurrentlyBimIndexBlendingField;
  }

  private set currentlyBimIndexBlending(value: boolean) {
    this.isCurrentlyBimIndexBlendingField = value;
  }

  private associatedBimIndices: Nullable<number[]> = null;

  private originalTransparencyMode: Nullable<number> = null;
  private originalAlpha: Nullable<number> = null;

  /**
   * List of inspectable custom properties (used by the Inspector)
   * @see https://doc.babylonjs.com/how_to/debug_layer#extensibility
   */
  public inspectableCustomProperties: IInspectable[];
  //#endregion

  //#region Helper functions

  /** Returns the name of this material class */
  public getClassName(): string {
    return 'TridifyPbrMaterial';
  }

  public setupProximityTransparency() {
    onChangeToOrbitMode.subscribe(() => {
      if (this.canFadeByProximity) this.setProximityFade(false);
    });

    onChangeToFreeMode.subscribe(() => {
      if (this.canFadeByProximity) this.setProximityFade(true);
    });
  }

  public getActiveTextures(): BaseTexture[] {
    const activeTextures = super.getActiveTextures();
    activeTextures.push(TridifyPbrMaterial.blueNoiseTexture!);
    return activeTextures;
  }

  public hasTexture(texture: BaseTexture): boolean {
    if (super.hasTexture(texture)) {
      return true;
    }
    if (TridifyPbrMaterial.blueNoiseTexture === texture) {
      return true;
    }
    return false;
  }

  public clone(name: string) {
    const clone = SerializationHelper.Clone(() => new TridifyPbrMaterial(name, this.getScene()), this);

    clone.id = name;
    clone.name = name;

    this.clearCoat.copyTo(clone.clearCoat);
    this.anisotropy.copyTo(clone.anisotropy);
    this.brdf.copyTo(clone.brdf);
    this.sheen.copyTo(clone.sheen);
    this.subSurface.copyTo(clone.subSurface);

    clone.fadeByProximity = this.fadeByProximity;
    clone.canFadeByProximity = this.canFadeByProximity;
    clone.isCurrentlyBimIndexBlendingField = this.isCurrentlyBimIndexBlendingField;
    clone.defaultVisibility = this.defaultVisibility;
    clone.associatedBimIndices = this.associatedBimIndices;
    clone.originalTransparencyMode = this.originalTransparencyMode;
    clone.originalAlpha = this.originalAlpha;
    clone.bimIndicesReplacementTexture = this.bimIndicesReplacementTexture;
    clone.bimColorsToReplaceTotal = this.bimColorsToReplaceTotal;
    clone.bimIndicesOpacityTexture = this.bimIndicesReplacementTexture;

    return clone;
  }

  public getAssociatedBimIndices(): number[] {
    if (this.associatedBimIndices === null) { this.assignAssociatedBimIndices(); }
    return this.associatedBimIndices!;
  }

  public getAssociatedBimColors(): Color4[] {
    const indices = this.getAssociatedBimIndices();
    return indices.map(bimIndex => (new Color4().fromUInt32(bimIndex)));
  }

  private assignAssociatedBimIndices(): void {

    const meshes = this.getBindedMeshes()
      .filter(mesh => (mesh.bimIndexPositionsMap));

    const indexMeshes = this.getBindedMeshes()
      .filter(mesh => (mesh.instanceBimIndices));

    const meshIndices = meshes.flatMap(mesh => Array.from(mesh.bimIndexPositionsMap.keys()));
    const instanceIndices = indexMeshes.flatMap(mesh => mesh.instanceBimIndices!);
    this.associatedBimIndices = meshIndices.concat(instanceIndices);
  }

  private opacityToArray(arrayLength: number, opacity: number | number[] = 0): number[] {

    let outputOpacity: number[] = [];
    // @ts-ignore
    if (opacity.length !== undefined) {

      // @ts-ignore
      if (!opacity.length) outputOpacity = [0];

      outputOpacity = opacity as number[];
    } else {
      outputOpacity = [(opacity as number)];
    }

    const defaultOpacity = outputOpacity.length ? outputOpacity[0] : 0;

    for (let i = 0; i < arrayLength; i++) {
      if (i >= outputOpacity.length - 1) {
        outputOpacity.push(defaultOpacity);
      }
    }

    return outputOpacity.map(opacity => Math.clamp(opacity, 0, 1));
  }

  //#endregion

  //#region Set visibility exceptions
  public setVisExceptionBimIndices(exceptionBimIndices: number[], visibleByDefault: boolean = true, opacity: number | number[] = 0): void {

    if (this.originalAlpha === null) {
      this.originalTransparencyMode = this.transparencyMode;
      this.originalAlpha = this.alpha;
    }

    const opacityArray = this.opacityToArray(exceptionBimIndices.length, opacity);

    const defaultOpacity = opacityArray[0];

    const newBimIndices: number[] = [];
    let newOpacities: number[] = [];

    exceptionBimIndices.forEach((bimIndex, arrIndex) => {
      if (this.getAssociatedBimIndices().includes(bimIndex)) {
        newBimIndices.push(exceptionBimIndices[arrIndex]);
        newOpacities.push(opacityArray[arrIndex]);
      }
    });

    newOpacities = !newOpacities.length ? [defaultOpacity] : newOpacities;

    const allOpacitiesAreTheSame = newOpacities.every(opacity => opacity === newOpacities[0]);

    newOpacities = allOpacitiesAreTheSame ? [newOpacities[0]] : newOpacities;

    const exceptionBimColors = newBimIndices.map(bimIndex => new Color4().fromUInt32(bimIndex));
    this.setVisExceptionBimColors(exceptionBimColors, visibleByDefault, newOpacities);
  }

  private setVisExceptionBimColors(exceptionBimColors: Color4[], defaultVisibility: boolean = true, opacityArray: number[]): void {

    const allBimIndicesAreException = exceptionBimColors.length === this.getAssociatedBimIndices().length;

    if (allBimIndicesAreException && opacityArray.length === 1) {
      // No need to use custom shader program if whole mesh is exception and only one opacity is given
      exceptionBimColors = [];
      opacityArray = [opacityArray[0]];
      defaultVisibility = !defaultVisibility;
    }

    const allOpacityIsOne = opacityArray.every(opacity => opacity === 1); // This is equivalent to setting default visible and no excpetion bim indices
    defaultVisibility = allOpacityIsOne ? true : defaultVisibility;
    const exceptionBimColorsFlatArray = allOpacityIsOne ? [] : exceptionBimColors.flatMap(bimColor => bimColor.asArray());

    opacityArray = defaultVisibility ? opacityArray : [opacityArray[0]]; // If default is invisible. Then we only need a single opacity instead of a texture

    this.defaultVisibility = defaultVisibility;

    //#region These vars are passed as shader defines. Set to false if shader shouldn't compile with these variables
    this.bimIndicesToChangeOpacityTotal = exceptionBimColorsFlatArray.length ? exceptionBimColorsFlatArray.length : false;
    this.singleOpacity = (opacityArray.length === 1) ? opacityArray[0] : false;
    //#endregion

    if (exceptionBimColorsFlatArray.length === 0) {
      this.setBimIndexOpacityToBoundMeshes(defaultVisibility);
      this.bimIndicesOpacityTexture = null;
    } else {
      this.setBimIndexOpacityToShader(opacityArray);
      this.bimIndicesOpacityTexture = this.createTextureFromDataArray(new Uint8Array(exceptionBimColorsFlatArray), 4);
      this.newOpacitiesTexture = this.singleOpacity ? null : this.createTextureFromDataArray(new Uint8Array(opacityArray.map(opacity => opacity * 255)), 1);
    }

    this.markAsDirty(Constants.MATERIAL_MiscDirtyFlag);
  }

  private setBimIndexOpacityToBoundMeshes(defaultVisibility: boolean) {
    if (this.singleOpacity !== false) {

      const binaryVisibility = this.singleOpacity === 0 || this.singleOpacity === 1;

      const shouldBlendOpacity = !defaultVisibility && !binaryVisibility;

      this.getBindedMeshes().map(mesh => mesh.isVisible = defaultVisibility || shouldBlendOpacity);

      this.transparencyMode = shouldBlendOpacity ? Material.MATERIAL_ALPHABLEND : this.originalTransparencyMode;
      this.alpha = shouldBlendOpacity ? (this.singleOpacity as number) : this.originalAlpha!;

      this.currentlyBimIndexBlending = shouldBlendOpacity;
      this.needDepthPrePass = this.id === 'spaceMeshes' ? false : shouldBlendOpacity;
    } else {
      console.error('Single opacity is missing for passing to bound meshes');
    }
  }

  private setBimIndexOpacityToShader(opacityArray: number[]) {

    const allOpacityIsOne = opacityArray.every(opacity => opacity === 1);
    const allOpacityIsZero = opacityArray.every(opacity => opacity === 0);

    const shouldBlendOpacity = !(allOpacityIsOne || allOpacityIsZero);
    const blendMode = (this.id === 'spaceMeshes') ?  Material.MATERIAL_ALPHATEST : Material.MATERIAL_ALPHABLEND;
    this.transparencyMode = shouldBlendOpacity ? blendMode : this.originalTransparencyMode;
    const newAlpha = (this.originalAlpha! >= 1) ? 0.999 : this.originalAlpha!; // Force fake alpha, or preserve alpha of transparent meshes.
    this.alpha = shouldBlendOpacity ? newAlpha : this.originalAlpha!;

    this.currentlyBimIndexBlending = shouldBlendOpacity;
    this.needDepthPrePass = this.id === 'spaceMeshes' ? false : shouldBlendOpacity;
  }

  private updateBoundMeshesOpacityOrder(): void {
    this.getBindedMeshes().forEach(mesh => {
      mesh.updateFacetData();
    });
  }

  //#endregion

  //#region Set replacement colors
  public setReplaceColorBimIndices(bimIndices: number[], replacementColors: Color4[]): void {
    if (this.originalAlpha === null) {
      this.originalTransparencyMode = this.transparencyMode;
      this.originalAlpha = this.alpha;
    }
    let newBimIndices: number[] = [];
    let newReplacementColors: Color4[] = [];

    bimIndices.forEach((bimIndex, index) => {
      if (!newBimIndices.includes(bimIndex) && this.getAssociatedBimIndices().includes(bimIndex)) {
        newBimIndices.push(bimIndex);
        const newReplacementColor = replacementColors[index];
        newReplacementColors.push(newReplacementColor ? newReplacementColor : TridifyPbrMaterial.defaultReplacementColor);
      }
    });

    const allColorsAreSame = replacementColors.every(color => color.equals(replacementColors[0]));
    const allBimIndicesColored = this.getAssociatedBimIndices().every(associatedBimIndex => newBimIndices.includes(associatedBimIndex));

    if (allBimIndicesColored && allColorsAreSame) {
      newBimIndices = [];
      newReplacementColors = [newReplacementColors[0]];
    }

    const bimIndexColors = newBimIndices.map(bimIndex => (new Color4().fromUInt32(bimIndex)));
    this.setBimColorsToReplaceColor(bimIndexColors, newReplacementColors);
  }

  private setBimColorsToReplaceColor(bimIndexColors: Color4[], replacementColors: Color4[]): void {

    if (bimIndexColors.length === 0) {
      if (replacementColors.length === 1) {
        this.setSingleReplacementColor(replacementColors[0]);
      } else {
        this.clearReplacementColors();
      }
    } else {
      this.setReplacementColorsToShader(bimIndexColors, replacementColors);
    }
    this.markAsDirty(Constants.MATERIAL_MiscDirtyFlag);
  }

  private setSingleReplacementColor(color: Color4): void {
    this.singleReplacementColor = color.clone();
    this.transparencyMode = (this.singleReplacementColor!.a < 1) ? Material.MATERIAL_ALPHABLEND : this.originalTransparencyMode;
    this.getBindedMeshes().map(mesh => mesh.alphaIndex = (this.singleReplacementColor!.a < 1) ? 0 : Number.MAX_VALUE);
  }

  private clearReplacementColors(): void {
    this.singleReplacementColor = null;
    this.bimIndicesReplacementTexture = null;
    this.bimColorsToReplaceTotal = 0;
    this.transparencyMode = this.originalTransparencyMode;
    this.alpha = this.originalAlpha!;
    this.getBindedMeshes().map(mesh => mesh.alphaIndex = Number.MAX_VALUE);
  }

  private setReplacementColorsToShader(bimIndexColors: Color4[], replacementColors: Color4[]): void {
    const newBimColors = bimIndexColors.flatMap(bimColor => bimColor.asArray());
    const newReplacementColors = replacementColors.flatMap(replacementColor => replacementColor.asArray());
    const containsTransparent = this.colorsContainTransparent(replacementColors);
    this.transparencyMode = containsTransparent ? Material.MATERIAL_ALPHABLEND : this.originalTransparencyMode;
    this.alpha = containsTransparent ? 0.9999 : this.originalAlpha!;
    // Prioritize our new faded components in the drawing order
    this.getBindedMeshes().map(mesh => mesh.alphaIndex = containsTransparent ? 0 : Number.MAX_VALUE);

    const dataArray = new Uint8Array(newBimColors.concat(newReplacementColors.map(channel => channel * 255)));
    this.bimIndicesReplacementTexture = this.createTextureFromDataArray(dataArray, 4);

    this.bimColorsToReplaceTotal = newBimColors.length / 4;

    this.singleReplacementColor = null;
  }

  private strideToTextureFormat(stride: number): number {
    if (stride === 4) {
      return Constants.TEXTUREFORMAT_RGBA;
    } else if (stride === 3) {
      return Constants.TEXTUREFORMAT_RGB;
    } else if (stride === 1) {
      return Constants.TEXTUREFORMAT_ALPHA;
    } else {
      console.error(`Can't create texture format with stride ${stride}`);
      return Constants.TEXTUREFORMAT_RGBA;
    }
  }

  private createTextureFromDataArray(array: Uint8Array, stride: number): RawTexture {

    const type = Constants.TEXTURETYPE_UNSIGNED_BYTE;
    const format = this.strideToTextureFormat(stride);
    const samplingMode = RawTexture.NEAREST_NEAREST;

    const texture = new RawTexture(array, array.length / stride, 1, format, this.getScene(), false, false, samplingMode, type);
    texture.gammaSpace = true;
    texture.anisotropicFilteringLevel = 0;
    texture.wrapR = Texture.CLAMP_ADDRESSMODE;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;

    return texture;
  }

  private colorsContainTransparent(colors: Color4[]): boolean {
    return colors.find(color => (color.a !== 1)) !== undefined;
  }
  //#endregion

  //#region Set Proximity fade
  public setProximityFade(value: boolean): void {
    this.fadeByProximity = value;
    this.markAsDirty(Constants.MATERIAL_MiscDirtyFlag);
  }
  //#endregion

  //#region Constructor
  constructor(name: string, scene: Scene) {
    super(name, scene);

    if (!TridifyPbrMaterial.blueNoiseTexture) {
      TridifyPbrMaterial.blueNoiseTexture = new Texture('./Textures/Noise/LDR_LLL1_0.png', scene, true, true, Texture.NEAREST_LINEAR);
      this.createShader();
    }

    onAfterCameraStoppedMoving.subscribe(() => {
      if (this.isCurrentlyBimIndexBlending) {
        this.updateBoundMeshesOpacityOrder();
      }
    });

    this.customShaderNameResolve = (s, uniforms, uniformBuffers, samplers, defines, attributes) => {
      defines = defines as MaterialDefines;

      defines.PROXIMITY_FADE = this.fadeByProximity;

      defines.BIMINDICES_TO_CHANGE_OPACITY = this.bimIndicesToChangeOpacityTotal ? this.bimIndicesToChangeOpacityTotal : false;
      defines.SINGLE_OPACITY = this.singleOpacity;
      defines.INVISIBLE_BY_DEFAULT = (!this.defaultVisibility) ? '1.' : '0.'; // TODO: Rewrite to be more clear
      defines.BIMINDICES_TO_REPLACE_COLOR = this.bimColorsToReplaceTotal ? this.bimColorsToReplaceTotal : false;
      defines.SINGLE_REPLACEMENT_COLOR = this.singleReplacementColor ? this.singleReplacementColor.toGLSL() : false;

      if (this.bimIndicesToChangeOpacityTotal || this.bimColorsToReplaceTotal) {
        attributes?.push(VertexBuffer.ColorKind);
      }
      if (this.fadeByProximity) {
        uniforms.push('lowestFadeLevel');
        uniforms.push('distToStartFadeMult');
        samplers.push('blueNoiseSampler');
      }
      if (this.bimIndicesOpacityTexture) {
        samplers.push('bimIndicesOpacitySampler');
      }
      if (this.newOpacitiesTexture) {
        samplers.push('newOpacitiesSampler');
      }
      if (this.bimIndicesReplacementTexture) {
        samplers.push('bimIndicesReplacementSampler');
      }

      defines.rebuild();
      return 'tridifyPbr';
    };

    this.onCompiled = (effect) => {
      effect.setFloat('lowestFadeLevel', TridifyPbrMaterial.lowestProximityAlpha);
      effect.setFloat('distToStartFadeMult', 1 / (TridifyPbrMaterial.distanceToStartFade ** 2)); // Cheaper to multiply than divide in shader
    };

    this.onBindObservable.add(() => {
      const effect = this.getEffect();
      if (effect) {
        if (this.bimIndicesOpacityTexture) {
          effect.setTexture('bimIndicesOpacitySampler', this.bimIndicesOpacityTexture);
        }
        if (this.newOpacitiesTexture) {
          effect.setTexture('newOpacitiesSampler', this.newOpacitiesTexture);
        }
        if (this.bimColorsToReplaceTotal) {
          effect.setTexture('bimIndicesReplacementSampler', this.bimIndicesReplacementTexture!);
        }
        if (this.canFadeByProximity && TridifyPbrMaterial.blueNoiseTexture) {
          effect.setTexture('blueNoiseSampler', TridifyPbrMaterial.blueNoiseTexture);
        }
      }
    });

    this.setupProximityTransparency();

    this.inspectableCustomProperties = TridifyPbrMaterialInspectableProperties;
  }
  //#endregion

  //#region Shader
  private createShader() {

    //#region vertex shader
    // Custom vertex functions

    Effect.ShadersStore.tridifyPbrVertexShader =
      Effect.ShadersStore.pbrVertexShader.replace('#ifdef VERTEXCOLOR\nattribute vec4 color;\n#endif',
        `
      #if defined(VERTEXCOLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY) || defined(PROXIMITY_FADE)  || defined(BIMINDICES_TO_REPLACE_COLOR)
        attribute vec4 color;
      #endif
      `);

    Effect.ShadersStore.tridifyPbrVertexShader =
      Effect.ShadersStore.tridifyPbrVertexShader.replace('#ifdef VERTEXCOLOR\nvarying vec4 vColor;\n#endif',
        `
        #if defined(VERTEXCOLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY) || defined(PROXIMITY_FADE)  || defined(BIMINDICES_TO_REPLACE_COLOR)
          varying vec4 vColor;
        #endif
        `);

    Effect.ShadersStore.tridifyPbrVertexShader =
      Effect.ShadersStore.tridifyPbrVertexShader.replace('#ifdef VERTEXCOLOR\nvColor=color;\n#endif',
        `
        #if defined(VERTEXCOLOR) || defined(PROXIMITY_FADE) || defined(BIMINDICES_TO_REPLACE_COLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY)
          vColor = color;
        #endif
        `);
    //#endregion

    //#region extra varying declaration
    // Change in include file
    Effect.IncludesShadersStore.tridifyExtraPbrDeclaration =
      Effect.IncludesShadersStore.pbrFragmentExtraDeclaration.replace('#ifdef VERTEXCOLOR\nvarying vec4 vColor;\n#endif',
        `
      #if defined(VERTEXCOLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY) || defined(PROXIMITY_FADE) || defined(BIMINDICES_TO_REPLACE_COLOR)
        varying vec4 vColor;
      #endif
      `);
    //#endregion

    //#region fragment shader
    // Add uniforms
    Effect.ShadersStore.tridifyPbrPixelShader =
      Effect.ShadersStore.pbrPixelShader.replace('#define CUSTOM_FRAGMENT_DEFINITIONS',
        `
    #define CUSTOM_FRAGMENT_DEFINITIONS
    #ifdef PROXIMITY_FADE
      uniform float lowestFadeLevel;
      uniform float distToStartFadeMult;
      uniform sampler2D blueNoiseSampler;
    #endif

    #ifdef BIMINDICES_TO_CHANGE_OPACITY
      uniform sampler2D bimIndicesOpacitySampler;
      uniform sampler2D newOpacitiesSampler;
    #endif

    #ifdef BIMINDICES_TO_REPLACE_COLOR
      uniform sampler2D bimIndicesReplacementSampler;
    #endif

    #if defined(BIMINDICES_TO_REPLACE_COLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY)
      float compareColors(vec4 col0, vec4 col1) {
        vec4 val = abs(col0-col1);
        return 1. - step(0.9, val.x + val.y + val.z + val.w);
      }
    #endif
    `);

    Effect.ShadersStore.tridifyPbrPixelShader =
      Effect.ShadersStore.tridifyPbrPixelShader.replace('#include<clipPlaneFragment>',
        `
    #if defined(VERTEXCOLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY) || defined(PROXIMITY_FADE) || defined(BIMINDICES_TO_REPLACE_COLOR)
      vec4 vertexColor = vColor;
    #endif

    #include<clipPlaneFragment>

    #ifdef PROXIMITY_FADE
      vec3 diff = vPositionW - vEyePosition.xyz;
      float distanceSqr = dot(diff, diff);
      distanceSqr = distanceSqr * distToStartFadeMult;
      distanceSqr = clamp(distanceSqr, lowestFadeLevel, 2.);

      vec2 noiseCoords = gl_FragCoord.xy * 0.015625;
      float noise = texture2D(blueNoiseSampler, noiseCoords).r;

      float proximityFade = (1. - step(0., noise - distanceSqr)) *  0.001;

      if(proximityFade <= 0.) {
        discard;
      }
    #endif
    `);

    Effect.ShadersStore.tridifyPbrPixelShader =
      Effect.ShadersStore.tridifyPbrPixelShader.replace('#define CUSTOM_FRAGMENT_BEFORE_LIGHTS',
        `
    #if defined(BIMINDICES_TO_REPLACE_COLOR)

      vec4 newColor = vec4(0., 0., 0., 0.);

      float doChangeColor = 0.;

      for(int i=0;i<BIMINDICES_TO_REPLACE_COLOR;++i) {

        #if defined(WEBGL2)

          vec4 bimColor = texelFetch(bimIndicesReplacementSampler, ivec2(i, 0), 0);
          vec4 replacementColor = texelFetch(bimIndicesReplacementSampler, ivec2(BIMINDICES_TO_REPLACE_COLOR + i, 0), 0);
        #else

          float xCoord = ((float(i) + 0.5) / float(BIMINDICES_TO_REPLACE_COLOR)) * 0.5;
          vec4 bimColor = texture2D(bimIndicesReplacementSampler, vec2(xCoord, 0.5));
          vec4 replacementColor = texture2D(bimIndicesReplacementSampler, vec2(0.5 + xCoord, 0.5));
        #endif

        float bimIndexMatchColor = compareColors(bimColor * 255., vertexColor);
        doChangeColor += bimIndexMatchColor;

        newColor += replacementColor * bimIndexMatchColor;
      }

      float doNotChangeColor = 1. - doChangeColor;

      vec4 originalColor = vec4(surfaceAlbedo.xyz, alpha);

      newColor = (originalColor * doNotChangeColor) + (newColor * doChangeColor);

      surfaceAlbedo = newColor.xyz;
      alpha = newColor.w;

    #endif

    #if defined( SINGLE_REPLACEMENT_COLOR )
      surfaceAlbedo = SINGLE_REPLACEMENT_COLOR.xyz;
      alpha = SINGLE_REPLACEMENT_COLOR.w;
    #endif

    #if defined(BIMINDICES_TO_CHANGE_OPACITY)

      float bimIndexMatchOpacity = 0.;

      #if defined( SINGLE_OPACITY )
        float newOpacity = float(SINGLE_OPACITY);
      #else
        float newOpacity = 0.;
      #endif

      for(int i=0;i<BIMINDICES_TO_CHANGE_OPACITY;++i) {

        float currentMatch = 0.;

        #if defined(WEBGL2)
          ivec2 indexUv = ivec2(i, 0);

          vec4 bimColor = texelFetch(bimIndicesOpacitySampler, indexUv, 0);
          currentMatch = compareColors(bimColor * 255., vertexColor);

          #if !defined( SINGLE_OPACITY )
            newOpacity += texelFetch(newOpacitiesSampler, indexUv, 0).w * currentMatch;
          #endif
        #else
          float xCoord = (float(i) + 0.5) / float(BIMINDICES_TO_CHANGE_OPACITY);
          vec2 indexUv = vec2(xCoord, 0.5);

          vec4 bimColor = texture2D(bimIndicesOpacitySampler, indexUv);
          currentMatch = compareColors(bimColor * 255., vertexColor);

          #if !defined( SINGLE_OPACITY )
            newOpacity += texture2D(newOpacitiesSampler, indexUv).w * currentMatch;
          #endif
        #endif

        bimIndexMatchOpacity += currentMatch;
      }

      float isVisible = abs((1. - bimIndexMatchOpacity) - INVISIBLE_BY_DEFAULT);
      float isInvisible = 1. - isVisible;

      alpha = (alpha * isVisible) + (newOpacity * isInvisible);
    #endif

    #if defined(BIMINDICES_TO_REPLACE_COLOR) || defined(BIMINDICES_TO_CHANGE_OPACITY)
      if(alpha <= 0.) {
        discard;
      }
    #endif

    #define CUSTOM_FRAGMENT_BEFORE_LIGHTS
  `);

    // Change include source
    Effect.ShadersStore.tridifyPbrPixelShader =
      Effect.ShadersStore.tridifyPbrPixelShader.replace('#include<pbrFragmentExtraDeclaration>',
        `#include<tridifyExtraPbrDeclaration>`);
    //#endregion
  }
  //#endregion
}
