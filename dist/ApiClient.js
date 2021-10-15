import { __awaiter, __generator } from "tslib";
import * as localforage from 'localforage';
localforage.config({
    name: 'floorplan-viewer'
});
export var API_BASE_URL = process.env.VUE_APP_API_URL || "https://ws.tridify.com/api";
export var PartialIfcType;
(function (PartialIfcType) {
    PartialIfcType[PartialIfcType["Types"] = 0] = "Types";
    PartialIfcType[PartialIfcType["Decomposition"] = 1] = "Decomposition";
    PartialIfcType[PartialIfcType["Units"] = 2] = "Units";
    PartialIfcType[PartialIfcType["Header"] = 3] = "Header";
    PartialIfcType[PartialIfcType["Layers"] = 4] = "Layers";
    PartialIfcType[PartialIfcType["Materials"] = 5] = "Materials";
})(PartialIfcType || (PartialIfcType = {}));
function partialIfcTypeToName(type) {
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
export function getMaterialLibrary(conversionHash) {
    return __awaiter(this, void 0, void 0, function () {
        var url, fetchConfig, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = API_BASE_URL + "/shared/conversion/" + conversionHash + "/material-library";
                    fetchConfig = { mode: 'cors' };
                    errorMessage = "Error while fetching material library";
                    return [4 /*yield*/, fetchUrl(url, fetchConfig, errorMessage)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get IFC property sets & quantities for an object from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {string} objectGuid The GUID of the target IFC object
 * @returns - The property sets object or null if not found or an error occurred
 */
export function getIfcObjectPropertySets(conversionHash, objectGuid) {
    return __awaiter(this, void 0, void 0, function () {
        var url, fetchConfig, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = API_BASE_URL + "/shared/conversion/" + conversionHash + "/properties/" + objectGuid;
                    fetchConfig = { mode: 'cors' };
                    errorMessage = "Error while fetching property sets";
                    return [4 /*yield*/, fetchUrl(url, fetchConfig, errorMessage)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get IFC property sets & quantities for an object for a draft published link from Tridify API
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {string} objectGuid The GUID of the target IFC object
 * @returns - The property sets object or null if not found or an error occurred
 */
export function getDraftIfcObjectPropertySets(conversionHash, objectGuid) {
    return __awaiter(this, void 0, void 0, function () {
        var url, fetchConfig, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = API_BASE_URL + "/draft/" + conversionHash + "/properties/" + objectGuid;
                    fetchConfig = { mode: 'cors', credentials: 'include' };
                    errorMessage = "Error while fetching draft property sets";
                    return [4 /*yield*/, fetchUrl(url, fetchConfig, errorMessage)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get a published link by a share key from the Tridify API
 * @param {string} shareKey - The share key of the published link
 * @returns {Promise<PublishedLinkDTO | null>} - Returns the published link data or null if not found or an error occurred
 */
export function getPublishedLink(shareKey) {
    return __awaiter(this, void 0, void 0, function () {
        var url, fetchConfig, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = API_BASE_URL + "/shared/published-links/" + shareKey;
                    fetchConfig = { mode: 'cors' };
                    errorMessage = "Error while fetching published link";
                    return [4 /*yield*/, fetchUrl(url, fetchConfig, errorMessage)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get a draft published link from the Tridify API
 * @returns {Promise<PublishedLinkDTO | null>} - Returns the published link data or null if not found or an error occurred
 */
export function getDraftPublishedLink() {
    return __awaiter(this, void 0, void 0, function () {
        var url, fetchConfig, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = API_BASE_URL + "/published-links/draft";
                    fetchConfig = { mode: 'cors', credentials: 'include' };
                    errorMessage = "Error while fetching draft published link";
                    return [4 /*yield*/, fetchUrl(url, fetchConfig, errorMessage)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get IFC hierarchy from Tridify API, caches the results to local storage
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @returns - The IFC hierarchy as an object or null if not found or an error occurred
 */
export function getIfcHierarchy(conversionHash) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchFromCacheOrGet("/shared/conversion/" + conversionHash + "/ifc-hierarchy")];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Get partial IFC data by property key from Tridify API, caches the results to local storage
 * @param {string} conversionHash The shared conversion hash of the target conversion, found in the published link data
 * @param {PartialIfcType} partialIfcType The key of the partial data that should be fetched
 * @returns - The partial IFC data as an object or null if not found or an error occurred
 */
export function getPartialIfcData(conversionHash, partialIfcType) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchFromCacheOrGet("/shared/conversion/" + conversionHash + "/ifc/" + partialIfcTypeToName(partialIfcType))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Do a GET request to an URL with caching.
 * If the data exists in cache it will be returned instantly, otherwise a GET request is done and the data is cached to the browser's local storage.
 * Note: The data returned by the request must be JSON.
 * @param url The URL that should be fetched
 * @returns - The results as an object or null if not found or an error occurred
 */
// TODO: Use babylonjs cache functions instead
export function fetchFromCacheOrGet(url) {
    return __awaiter(this, void 0, void 0, function () {
        var json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchFromCacheRaw(url)];
                case 1:
                    json = _a.sent();
                    try {
                        return [2 /*return*/, JSON.parse(json)];
                    }
                    catch (err) {
                        console.error("Error while fetching URL '" + url + "' - Could not parse JSON", json);
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// TODO: Use babylonjs cache functions instead
function fetchFromCacheRaw(url) {
    return __awaiter(this, void 0, void 0, function () {
        var keyPrefix, key, cachedItem, response, responseText, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keyPrefix = 'floorplanviewer_';
                    key = keyPrefix + url;
                    return [4 /*yield*/, localforage.getItem(key)];
                case 1:
                    cachedItem = _a.sent();
                    if (cachedItem)
                        return [2 /*return*/, cachedItem];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 7, , 8]);
                    return [4 /*yield*/, fetch(url)];
                case 3:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 6];
                    return [4 /*yield*/, response.text()];
                case 4:
                    responseText = _a.sent();
                    return [4 /*yield*/, localforage.setItem(key, responseText)
                            .catch(function (err) { return console.error('Error while setting item to localForage', err); })];
                case 5:
                    _a.sent();
                    return [2 /*return*/, responseText];
                case 6: return [2 /*return*/, null];
                case 7:
                    err_1 = _a.sent();
                    console.error("Error while fetching " + url, err_1);
                    return [2 /*return*/, null];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function fetchUrl(url, fetchConfig, errorMessage) {
    return __awaiter(this, void 0, void 0, function () {
        var response, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, fetch(url, fetchConfig)];
                case 1:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.json()];
                case 2: return [2 /*return*/, _a.sent()];
                case 3: return [2 /*return*/, null];
                case 4:
                    err_2 = _a.sent();
                    console.error(errorMessage, err_2);
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=ApiClient.js.map