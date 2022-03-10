"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const upload_1 = __importDefault(require("./upload"));
const MountRoutes = (app) => {
    app.use('/upload', upload_1.default);
};
exports.default = MountRoutes;
//# sourceMappingURL=index.js.map