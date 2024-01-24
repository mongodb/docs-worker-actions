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
// import * as core from '@actions/core';
// import * as github from '@actions/github';
const path_1 = __importDefault(__nccwpck_require__(17));
const stream_1 = __nccwpck_require__(781);
const promises_1 = __nccwpck_require__(845);
const readline_1 = __importDefault(__nccwpck_require__(521));
async function run() {
    try {
        console.log('in action!!');
        const file = 'output.txt';
        await downloadFile("https://snooty-data-api.mongodb.com/projects/cloud-docs/master/documents", file);
        console.log('downloaded file, I guess');
        const documents = [];
        let metadata;
        await readline_1.default.createInterface({
            input: fs_1.default.createReadStream(file),
            terminal: false
        }).on('line', function (line) {
            const parsedLine = JSON.parse(line);
            if (parsedLine.type === 'page') {
                documents.push(parsedLine.data);
            }
            else if (parsedLine.type === 'metadata') {
                metadata = parsedLine.data;
            }
        }).on('close', function () {
            const writable = fs_1.default.createWriteStream('snooty-documents.json', { flags: 'w' });
            writable.write(JSON.stringify(documents));
            const metadataWriter = fs_1.default.createWriteStream('snooty-metadata.json', { flags: 'w' });
            metadataWriter.write(JSON.stringify(metadata));
        });
        console.log('now should git clone and run snooty...');
    }
    catch (error) {
        console.log('Error occurred when retrieving Webhook URL', error);
        throw error;
    }
}
exports.run = run;
const downloadFile = async (url, fileName) => {
    const res = await fetch(url);
    if (!res.body)
        return;
    const destination = path_1.default.resolve("./", fileName);
    const fileStream = fs_1.default.createWriteStream(destination, { flags: 'wx' });
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