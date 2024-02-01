/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 752:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.run = void 0;
const fs_1 = __importDefault(__nccwpck_require__(147));
const path_1 = __importDefault(__nccwpck_require__(17));
const readline_1 = __importDefault(__nccwpck_require__(521));
const stream_1 = __nccwpck_require__(781);
const promises_1 = __nccwpck_require__(845);
async function run() {
    try {
        const file = 'output.txt';
        /* Fetch Snooty project build data */
        await downloadSnootyProjectBuildData(`https://snooty-data-api.mongodb.com/projects/${process.env.PROJECT_TO_BUILD}/master/documents`, file);
        let metadata;
        const documents = [];
        const assets = {};
        /* Write each line to separate files in expected data structure for Snooty */
        readline_1.default.createInterface({
            input: fs_1.default.createReadStream(file),
            terminal: false
        }).on('line', function (lineString) {
            const line = JSON.parse(lineString);
            switch (line.type) {
                case ('page'):
                    documents.push(line.data);
                    break;
                case ('metadata'):
                    metadata = line.data;
                    break;
                case ('asset'):
                    assets[line.data.checksum] = line.data.assetData;
                    break;
            }
        }).on('close', function () {
            const documentsWriter = fs_1.default.createWriteStream('snooty-documents.json');
            documentsWriter.write(JSON.stringify(documents));
            const metadataWriter = fs_1.default.createWriteStream('snooty-metadata.json');
            metadataWriter.write(JSON.stringify(metadata));
            fs_1.default.mkdirSync('assets', { recursive: true });
            for (const checksum in assets) {
                const assetsWriter = fs_1.default.createWriteStream(`assets/${checksum}`, { encoding: 'base64' });
                assetsWriter.write(assets[checksum]);
            }
        });
    }
    catch (error) {
        console.error(`Error occurred when fetching and writing build data for ${process.env.PROJECT_TO_BUILD}`, error);
        throw error;
    }
}
exports.run = run;
const downloadSnootyProjectBuildData = async (endpoint, targetFilename) => {
    const res = await fetch(endpoint);
    if (!res.body)
        return;
    const destination = path_1.default.resolve("./", targetFilename);
    const fileStream = fs_1.default.createWriteStream(destination);
    await (0, promises_1.finished)(stream_1.Readable.fromWeb(res.body).pipe(fileStream));
};


/***/ }),

/***/ 147:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 17:
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ 521:
/***/ ((module) => {

module.exports = require("readline");

/***/ }),

/***/ 781:
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ 845:
/***/ ((module) => {

module.exports = require("stream/promises");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const run_1 = __nccwpck_require__(752);
(0, run_1.run)();

})();

module.exports = __webpack_exports__;
/******/ })()
;