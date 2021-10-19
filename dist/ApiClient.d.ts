import { IfcHierarchyDTO, MaterialLibraryDTO, ObjectPropertySetsDTO, PublishedLinkDTO } from "./DTO/DTO";
export declare const API_BASE_URL: string;
export declare enum PartialIfcType {
    Types = 0,
    Decomposition = 1,
    Units = 2,
    Header = 3,
    Layers = 4,
    Materials = 5
}
/**
 * Get the material library for a conversion from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @returns - The material library object or null if not found or an error occurred
 */
export declare function getMaterialLibrary(conversionHash: string): Promise<MaterialLibraryDTO | null>;
/**
 * Get IFC property sets & quantities for an object from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {string} objectGuid The GUID of the target IFC object
 * @returns - The property sets object or null if not found or an error occurred
 */
export declare function getIfcObjectPropertySets(conversionHash: string, objectGuid: string): Promise<ObjectPropertySetsDTO | null>;
/**
 * Get IFC property sets & quantities for an object for a draft published link from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {string} objectGuid The GUID of the target IFC object
 * @returns - The property sets object or null if not found or an error occurred
 */
export declare function getDraftIfcObjectPropertySets(conversionHash: string, objectGuid: string): Promise<ObjectPropertySetsDTO | null>;
/**
 * Get a published link by a share key from the Tridify API
 * @param {string} shareKey - The share key of the published link
 * @returns {Promise<PublishedLinkDTO | null>} - Returns the published link data or null if not found or an error occurred
 */
export declare function getPublishedLink(shareKey: string): Promise<PublishedLinkDTO | null>;
/**
 * Get a draft published link from the Tridify API
 * @returns {Promise<PublishedLinkDTO | null>} - Returns the published link data or null if not found or an error occurred
 */
export declare function getDraftPublishedLink(): Promise<PublishedLinkDTO | null>;
/**
 * Get IFC hierarchy from Tridify API, caches the results to local storage
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @returns - The IFC hierarchy as an object or null if not found or an error occurred
 */
export declare function getIfcHierarchy(conversionHash: string): Promise<IfcHierarchyDTO | null>;
/**
 * Get partial IFC data by property key from Tridify API, caches the results to local storage
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {PartialIfcType} partialIfcType The key of the partial data that should be fetched
 * @returns - The partial IFC data as an object or null if not found or an error occurred
 */
export declare function getPartialIfcData(conversionHash: string, partialIfcType: PartialIfcType): Promise<any>;
/**
 * Do a GET request to an URL with caching.
 * If the data exists in cache it will be returned instantly, otherwise a GET request is done and the data is cached to the browser's local storage.
 * Note: The data returned by the request must be JSON.
 * @param url The URL that should be fetched
 * @returns - The results as an object or null if not found or an error occurred
 */
export declare function fetchFromCacheOrGet(url: string): Promise<any>;
