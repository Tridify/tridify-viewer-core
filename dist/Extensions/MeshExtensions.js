import { Mesh, Color4, Matrix } from "@babylonjs/core";
Mesh.prototype.getThinInstanceWorldMatrixAtIndex = function (index) {
    if (index >= this._thinInstanceDataStorage.instancesCount) {
        return null;
    }
    if (!this._thinInstanceDataStorage.matrixData || !this._thinInstanceDataStorage.matrixBuffer) {
        return null;
    }
    return Matrix.FromArray(this._thinInstanceDataStorage.matrixData, index * 16);
};
Mesh.prototype.getThinInstanceColorAtIndex = function (index) {
    var _a, _b;
    var colorBuffer = (_b = (_a = this._userThinInstanceBuffersStorage) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.color;
    if (!colorBuffer) {
        return null;
    }
    else {
        return Color4.FromArray(colorBuffer, index * 4);
    }
};
//# sourceMappingURL=MeshExtensions.js.map