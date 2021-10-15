import * as localforage from 'localforage';
import {IfcHierarchyDTO, MaterialLibraryDTO, ObjectPropertySetsDTO, PublishedLinkDTO} from "./DTO/DTO";

localforage.config({
  name: 'floorplan-viewer'
});

export const API_BASE_URL = process.env.VUE_APP_API_URL || "https://ws.tridify.com/api";

export enum PartialIfcType {
  Types,
  Decomposition,
  Units,
  Header,
  Layers,
  Materials
}

function partialIfcTypeToName(type: PartialIfcType): string {
  switch (type) {
    case PartialIfcType.Types:
      return "types";
    case PartialIfcType.Decomposition:
      return "decomposition";
    case PartialIfcType.Units:
      return "units";
    case PartialIfcType.Header:
      return "header";
    case PartialIfcType.Layers:
      return "layers";
    case PartialIfcType.Materials:
      return "materials";
  }
}

/**
 * Get the material library for a conversion from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @returns - The material library object or null if not found or an error occurred
 */
export async function getMaterialLibrary(conversionHash: string): Promise<MaterialLibraryDTO | null> {
  const url = `${API_BASE_URL}/shared/conversion/${conversionHash}/material-library`;
  const fetchConfig = {mode: 'cors'};
  const errorMessage = "Error while fetching material library";

  return await fetchUrl(url, fetchConfig, errorMessage) as MaterialLibraryDTO | null;
}

/**
 * Get IFC property sets & quantities for an object from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {string} objectGuid The GUID of the target IFC object
 * @returns - The property sets object or null if not found or an error occurred
 */
export async function getIfcObjectPropertySets(conversionHash: string, objectGuid: string): Promise<ObjectPropertySetsDTO | null> {
  const url = `${API_BASE_URL}/shared/conversion/${conversionHash}/properties/${objectGuid}`;
  const fetchConfig = {mode: 'cors'};
  const errorMessage = "Error while fetching property sets";

  return await fetchUrl(url, fetchConfig, errorMessage) as ObjectPropertySetsDTO | null;
}

/**
 * Get IFC property sets & quantities for an object for a draft published link from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {string} objectGuid The GUID of the target IFC object
 * @returns - The property sets object or null if not found or an error occurred
 */
export async function getDraftIfcObjectPropertySets(conversionHash: string, objectGuid: string): Promise<ObjectPropertySetsDTO | null> {
  const url = `${API_BASE_URL}/draft/${conversionHash}/properties/${objectGuid}`;
  const fetchConfig = {mode: 'cors', credentials: 'include'};
  const errorMessage = "Error while fetching draft property sets";

  return await fetchUrl(url, fetchConfig, errorMessage) as ObjectPropertySetsDTO | null;
}

/**
 * Get a published link by a share key from the Tridify API
 * @param {string} shareKey - The share key of the published link
 * @returns {Promise<PublishedLinkDTO | null>} - Returns the published link data or null if not found or an error occurred
 */
export async function getPublishedLink(shareKey: string): Promise<PublishedLinkDTO | null> {
  const url = `${API_BASE_URL}/shared/published-links/${shareKey}`;
  const fetchConfig = {mode: 'cors'};
  const errorMessage = "Error while fetching published link";

  return await fetchUrl(url, fetchConfig, errorMessage) as PublishedLinkDTO | null;
}

/**
 * Get a draft published link from the Tridify API
 * @returns {Promise<PublishedLinkDTO | null>} - Returns the published link data or null if not found or an error occurred
 */
export async function getDraftPublishedLink(): Promise<PublishedLinkDTO | null> {
  const url = `${API_BASE_URL}/published-links/draft`;
  const fetchConfig = {mode: 'cors', credentials: 'include'};
  const errorMessage = "Error while fetching draft published link";

  return await fetchUrl(url, fetchConfig, errorMessage) as PublishedLinkDTO | null;
}

/**
 * Get IFC hierarchy from Tridify API, caches the results to local storage
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @returns - The IFC hierarchy as an object or null if not found or an error occurred
 */
export async function getIfcHierarchy(conversionHash: string): Promise<IfcHierarchyDTO | null> {
  return await fetchFromCacheOrGet(`/shared/conversion/${conversionHash}/ifc-hierarchy`) as IfcHierarchyDTO | null;
}

/**
 * Get partial IFC data by property key from Tridify API, caches the results to local storage
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {PartialIfcType} partialIfcType The key of the partial data that should be fetched
 * @returns - The partial IFC data as an object or null if not found or an error occurred
 */
export async function getPartialIfcData(conversionHash: string, partialIfcType: PartialIfcType): Promise<any> {
  return await fetchFromCacheOrGet(`/shared/conversion/${conversionHash}/ifc/${partialIfcTypeToName(partialIfcType)}`);
}

/**
 * Do a GET request to an URL with caching.
 * If the data exists in cache it will be returned instantly, otherwise a GET request is done and the data is cached to the browser's local storage.
 * Note: The data returned by the request must be JSON.
 * @param url The URL that should be fetched
 * @returns - The results as an object or null if not found or an error occurred
 */
// TODO: Use babylonjs cache functions instead
export async function fetchFromCacheOrGet(url: string): Promise<any> {
  const json = await fetchFromCacheRaw(url);

  try {
    return JSON.parse(json);
  }
  catch (err) {
    console.error(`Error while fetching URL '${url}' - Could not parse JSON`, json);
    return null;
  }
}

// TODO: Use babylonjs cache functions instead
async function fetchFromCacheRaw(url: string): Promise<any> {
  const keyPrefix: string = 'floorplanviewer_';
  const key: string = keyPrefix + url;

  const cachedItem = await localforage.getItem<string>(key);

  if (cachedItem)
    return cachedItem;

  try {
    const response = await fetch(url);

    if (response.ok) {
      const responseText = await response.text();
      await localforage.setItem(key, responseText)
        .catch(err => console.error('Error while setting item to localForage', err));

      return responseText;
    }

    return null;
  }
  catch (err) {
    console.error(`Error while fetching ${url}`, err);
    return null;
  }
}

async function fetchUrl(url: string, fetchConfig: any, errorMessage: string): Promise<any> {
  try {
    const response = await fetch(url, fetchConfig);

    if (response.ok)
      return await response.json();

    return null;
  }
  catch (err) {
    console.error(errorMessage, err);
    return null;
  }
}
