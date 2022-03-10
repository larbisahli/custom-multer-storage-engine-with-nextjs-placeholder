"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const Storage_1 = __importDefault(require("./helpers/Storage"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Set S3 endpoint
const spacesEndpoint = new aws_sdk_1.default.Endpoint(process.env.SPACES_BUCKET_ENDPOINT);
const s3 = new aws_sdk_1.default.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SPACES_ACCESS_SECRET_KEY,
});
app.use((0, cors_1.default)());
app.use('/media', express_1.default.static('public'));
// setup a new instance of the AvatarStorage engine
const storage = (0, Storage_1.default)({
    s3,
    bucket: process.env.SPACES_BUCKET_NAME,
    acl: 'public-read',
    threshold: 1000,
    storage: 'locale',
    dir: 'public',
    output: 'jpg',
});
const limits = {
    files: 1,
    fileSize: 5 * (1024 * 1024), // 10 MB (max file size)
};
// setup multer
const upload = (0, multer_1.default)({
    storage,
    limits: limits,
});
app.post('/upload', upload.single('photo'), function (req, res) {
    const file = req.file;
    console.log('<= req.file =>', file); // form files
    const { mimetype, originalname, image, placeholder, bucket } = file;
    res.json({ mimetype, originalname, image, placeholder, bucket });
});
const PORT = 5000;
app.listen(PORT, function () {
    console.log(`Express Server started on port ${PORT}`);
});
//# sourceMappingURL=server.js.map