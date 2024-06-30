"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoCryptContextCtor = exports.MongoCrypt = void 0;
const bindings = require("bindings");
const mc = bindings('mongocrypt');
exports.MongoCrypt = mc.MongoCrypt;
exports.MongoCryptContextCtor = mc.MongoCryptContextCtor;
//# sourceMappingURL=index.js.map