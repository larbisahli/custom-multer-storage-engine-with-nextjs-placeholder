"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const jimp_1 = __importDefault(require("jimp"));
const concat_stream_1 = __importDefault(require("concat-stream"));
const streamifier_1 = __importDefault(require("streamifier"));
const slugify_1 = __importDefault(require("slugify"));
const nanoid_1 = require("nanoid");
const nanoid = (0, nanoid_1.customAlphabet)('abcdefghijklmnopqrstuvwxyz', 10);
const PNG = 'png';
const JPEG = 'jpeg' || 'jpg';
const typeS3 = 's3';
const typeLocal = 'locale';
class CustomStorageEngine {
    constructor(opts) {
        var _a, _b;
        // Create a file path based on date
        this.getPath = () => {
            var _a;
            const newDate = new Date();
            const Month = newDate.getMonth() + 1;
            const Year = newDate.getFullYear();
            const dir = (_a = this.options.dir) !== null && _a !== void 0 ? _a : this.defaultOptions.dir;
            const dirPath = `${Year}/${Month}`;
            const filePath = path_1.default.resolve(`${dir}/${Year}/${Month}`);
            if (!fs_1.default.existsSync(filePath)) {
                fs_1.default.mkdirSync(filePath, { recursive: true });
            }
            return { dirPath, filePath };
        };
        this._getMime = () => {
            var _a;
            // resolve the Jimp output mime type
            const output = (_a = this.options.output) !== null && _a !== void 0 ? _a : this.defaultOptions.output;
            switch (output) {
                case 'jpg':
                case 'jpeg':
                    return jimp_1.default.MIME_JPEG;
                case 'png':
                    return jimp_1.default.MIME_PNG;
                default:
                    return jimp_1.default.MIME_PNG;
            }
        };
        // return as filename with the output extension
        this.generateFilename = (file, output) => {
            var _a, _b, _c, _d;
            const newDate = new Date();
            const DateAsInt = Math.round(newDate.getTime() / 1000); // in seconds
            // trim a file extension from image and remove any possible dots in file name
            const filename = (_b = (_a = file === null || file === void 0 ? void 0 : file.originalname) === null || _a === void 0 ? void 0 : _a.replace(/\.[^/.]+$/, '')) === null || _b === void 0 ? void 0 : _b.replace(/\./g, '');
            if (filename) {
                const cleanedTitle = (0, slugify_1.default)(filename.replace(/[^A-Za-z0-9\s!?]/g, '').trim(), '_');
                return (((_c = (cleanedTitle + '__' + DateAsInt + '_' + nanoid())) === null || _c === void 0 ? void 0 : _c.toLowerCase()) +
                    '.' +
                    output);
            }
            return ((_d = (DateAsInt + '_' + nanoid())) === null || _d === void 0 ? void 0 : _d.toLowerCase()) + '.' + output;
        };
        this._createOutputStream = (filepath, cb) => {
            const output = fs_1.default.createWriteStream(filepath);
            // set callback fn as handler for the error event
            output.on('error', cb);
            // set handler for the finish event
            output.on('finish', () => {
                cb(null, {
                    destination: this.filepath,
                    mimetype: this._getMime(),
                    image: this.image,
                    placeholder: this.placeholder,
                });
            });
            // return the output stream
            return output;
        };
        this.writeImage = (filepath, image, cb, { isPlaceholder }) => {
            try {
                // get the buffer of the Jimp image using the output mime type
                image.getBuffer(this._getMime(), (err, buffer) => {
                    var _a;
                    const storage = (_a = this.options.storage) !== null && _a !== void 0 ? _a : this.defaultOptions.storage;
                    switch (storage) {
                        case typeLocal: {
                            // create a writable stream for it
                            const outputStream = this._createOutputStream(filepath, cb);
                            // create a read stream from the buffer and pipe it to the output stream
                            streamifier_1.default.createReadStream(buffer).pipe(outputStream);
                            break;
                        }
                        case typeS3:
                            this.options.s3.upload({
                                Bucket: this.options.bucket,
                                Key: isPlaceholder ? this.placeholder : this.image,
                                Body: streamifier_1.default.createReadStream(buffer),
                                ACL: this.options.acl,
                                ContentType: 'application/octet-stream',
                            }, (error, response) => {
                                if (!error) {
                                    cb(null, {
                                        destination: this.filepath,
                                        mimetype: this._getMime(),
                                        image: this.image,
                                        placeholder: this.placeholder,
                                        bucket: response.Bucket,
                                    });
                                }
                                else {
                                    cb(error);
                                }
                            });
                            break;
                        default:
                            break;
                    }
                });
            }
            catch (error) {
                console.log('error :>', error);
            }
        };
        this._processImage = (image, cb, file) => {
            var _a, _b, _c, _d;
            // Get options
            const output = (_a = this.options.output) !== null && _a !== void 0 ? _a : this.defaultOptions.output;
            const quality = (_b = this.options.quality) !== null && _b !== void 0 ? _b : this.defaultOptions.quality;
            const threshold = (_c = this.options.threshold) !== null && _c !== void 0 ? _c : this.defaultOptions.threshold;
            const placeholderSize = (_d = this.options.placeholderSize) !== null && _d !== void 0 ? _d : this.defaultOptions.placeholderSize;
            const filename = this.generateFilename(file, output);
            this.fileSharedName = filename;
            // create a clone of the Jimp image
            let clone = image.clone();
            // Auto scale the image dimensions to fit the threshold requirement
            if (threshold) {
                clone = clone.resize(threshold, jimp_1.default.AUTO);
            }
            // Set the image output quality
            clone = clone.quality(quality);
            const filenameSplit = filename.split('.');
            const _filename = filenameSplit[0];
            const _output = filenameSplit[1];
            const { filePath, dirPath } = this.getPath();
            this.filepath = filePath;
            // Original image processing
            const originalImage = clone.clone();
            const originalFilename = _filename + '.' + _output;
            // Set original image upload path
            this.image = `${dirPath}/${originalFilename}`;
            // create the complete filepath
            const originalFilepath = path_1.default.join(this.filepath, originalFilename);
            this.writeImage(originalFilepath, originalImage, cb, {
                isPlaceholder: false,
            });
            // Placeholder image processing
            const placeholderImage = clone.resize(placeholderSize, jimp_1.default.AUTO);
            const placeholderFilename = _filename + '_' + 'placeholder' + '.' + _output;
            // Set placeholder image upload path
            this.placeholder = `${dirPath}/${placeholderFilename}`;
            // create the complete filepath
            const placeholderFilepath = path_1.default.join(this.filepath, placeholderFilename);
            this.writeImage(placeholderFilepath, placeholderImage, cb, {
                isPlaceholder: true,
            });
        };
        this._handleFile = (req, file, cb) => {
            // create a writable stream using concat-stream that will
            // concatenate all the buffers written to it and pass the
            // complete buffer to a callback fn
            const fileManipulate = (0, concat_stream_1.default)((imageData) => {
                // read the image buffer with Jimp
                // returns a promise
                jimp_1.default.read(imageData)
                    .then((image) => {
                    // process the Jimp image buffer
                    this._processImage(image, cb, file);
                })
                    .catch(cb);
            });
            // write the uploaded file buffer to the fileManipulate stream
            file.stream.pipe(fileManipulate);
        };
        this._removeFile = (_req, file, cb) => {
            if (file.path) {
                fs_1.default.unlink(file.path, cb);
            }
            return;
        };
        this.options = opts || undefined;
        this.placeholder;
        this.image;
        this.filepath;
        this.fileSharedName;
        // fallback for options
        this.defaultOptions = {
            s3: null,
            bucket: null,
            acl: null,
            dir: null,
            output: 'png',
            storage: 'locale',
            quality: 90,
            threshold: null,
            placeholderSize: 26,
        };
        // You can add more options
        const allowedOutputFormats = ['jpg', 'jpeg', 'png'];
        if (this.options.dir && !fs_1.default.existsSync(this.options.dir)) {
            fs_1.default.mkdirSync(this.options.dir);
        }
        // If the option value is undefined or null it will fall back to the default option
        const allowedOutput = allowedOutputFormats === null || allowedOutputFormats === void 0 ? void 0 : allowedOutputFormats.includes((_b = String((_a = this.options.output) !== null && _a !== void 0 ? _a : this.defaultOptions.output)) === null || _b === void 0 ? void 0 : _b.toLowerCase());
        if (!allowedOutput)
            throw new Error('Output is not allowed');
        if (!this.options.dir)
            throw new Error('Expected dir to be string');
        switch (typeof opts.s3) {
            case 'object':
                if (!this.options.acl)
                    throw new Error('Expected acl to be string');
                if (!this.options.bucket)
                    throw new Error('Expected bucket to be string');
                break;
            default:
                if (this.options.storage === typeS3)
                    throw new TypeError('Expected opts.s3 to be object');
                break;
        }
    }
}
exports.default = (opts) => {
    return new CustomStorageEngine(opts);
};
//# sourceMappingURL=Storage.js.map