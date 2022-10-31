"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const storage_1 = __importDefault(require("./storage"));
const s3_1 = __importDefault(require("aws-sdk/clients/s3"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Set S3 endpoint
const s3 = new s3_1.default({
    region: process.env.AWS_BUCKET_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_SECRET_KEY,
});
app.use((0, cors_1.default)());
// setup a new instance of the AvatarStorage engine
const storage = (0, storage_1.default)({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    acl: 'public-read',
    threshold: 1000,
    output: 'jpg',
});
const limits = {
    files: 1,
    fileSize: 5 * (1024 * 1024), // 5 MB (max file size)
};
// setup multer
const upload = (0, multer_1.default)({
    storage,
    limits: limits,
});
app.post('/upload', upload.single('photo'), function (req, res) {
    const file = req.file;
    const { mimetype, originalname, image, placeholder, bucket } = file;
    res.json({ mimetype, originalname, image, placeholder, bucket });
});
app.get('/media/:y/:m/:key', function (req, res) {
    // y -> year, m -> month
    const { y, m, key } = req.params;
    const downloadParams = {
        Key: `${y}/${m}/${key}`,
        Bucket: process.env.AWS_BUCKET_NAME,
    };
    try {
        s3.getObject(downloadParams)
            .createReadStream()
            .on('error', (err) => {
            return res.status(400).send();
        })
            .pipe(res);
    }
    catch (error) {
        return res.status(500).send();
    }
});
const PORT = 5000;
app.listen(PORT, function () {
    console.log(`Express Server started on port ${PORT}`);
});
//# sourceMappingURL=server.js.map