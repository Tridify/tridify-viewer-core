import { Color4, Matrix, Nullable } from "@babylonjs/core";
declare module '@babylonjs/core/Meshes/mesh' {
    interface Mesh {
        /** get thin instance world matrix at thin instance index */
        getThinInstanceWorldMatrixAtIndex(index: number): Nullable<Matrix>;
        /** get thin instance color at thin instance index */
        getThinInstanceColorAtIndex(index: number): Nullable<Color4>;
    }
}
export {};
