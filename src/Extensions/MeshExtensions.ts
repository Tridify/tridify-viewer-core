import { Mesh, Color4, Matrix, Nullable } from "@babylonjs/core";

declare module '@babylonjs/core/Meshes/mesh' {
  interface Mesh {
    /** get thin instance world matrix at thin instance index */
    getThinInstanceWorldMatrixAtIndex(index: number): Nullable<Matrix>;
    /** get thin instance color at thin instance index */
    getThinInstanceColorAtIndex(index: number): Nullable<Color4>;
  }
}

Mesh.prototype.getThinInstanceWorldMatrixAtIndex = function(index: number): Nullable<Matrix> {
  if (index >= this._thinInstanceDataStorage.instancesCount) {
    return null;
  }

  if (!this._thinInstanceDataStorage.matrixData || !this._thinInstanceDataStorage.matrixBuffer) {
    return null;
  }

  return Matrix.FromArray(this._thinInstanceDataStorage.matrixData, index * 16);
};

Mesh.prototype.getThinInstanceColorAtIndex = function(index: number): Nullable<Color4> {
  const colorBuffer = this._userThinInstanceBuffersStorage?.data?.color;

  if (!colorBuffer) {
    return null;
  }
  else {
    return Color4.FromArray(colorBuffer, index * 4);
  }
};

export {}
