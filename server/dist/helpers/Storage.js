"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const jimp_1 = __importDefault(require("jimp"));
const concat_stream_1 = __importDefault(require("concat-stream"));
const streamifier_1 = __importDefault(require("streamifier"));
const slugify_1 = __importDefault(require("slugify"));
const nanoid_1 = require("nanoid");
const nanoid = (0, nanoid_1.customAlphabet)('abcdefghijklmnopqrstuvwxyz', 10);
const PNG = 'png';
const JPEG = 'jpeg' || 'jpg';
class CustomStorageEngine {
    constructor(opts) {
        var _a, _b;
        // Create a file path based on date
        this.getPath = () => {
            const newDate = new Date();
            const Month = newDate.getMonth() + 1;
            const Year = newDate.getFullYear();
            return `${Year}/${Month}`;
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
        this._processImage = (image, cb, file) => __awaiter(this, void 0, void 0, function* () {
            var _c, _d, _e, _f;
            // Get options
            const output = (_c = this.options.output) !== null && _c !== void 0 ? _c : this.defaultOptions.output;
            const quality = (_d = this.options.quality) !== null && _d !== void 0 ? _d : this.defaultOptions.quality;
            const threshold = (_e = this.options.threshold) !== null && _e !== void 0 ? _e : this.defaultOptions.threshold;
            const placeholderSize = (_f = this.options.placeholderSize) !== null && _f !== void 0 ? _f : this.defaultOptions.placeholderSize;
            const filename = this.generateFilename(file, output);
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
            const dirPath = this.getPath();
            // Original image processing
            const originalImageRespond = new Promise((resolve, reject) => {
                const originalImage = clone.clone();
                const originalFilename = _filename + '.' + _output;
                const image = `${dirPath}/${originalFilename}`;
                originalImage.getBuffer(this._getMime(), (err, buffer) => {
                    this.options.s3.upload({
                        Bucket: this.options.bucket,
                        Key: image,
                        Body: streamifier_1.default.createReadStream(buffer),
                        //   ACL: this.options.acl,
                        ContentType: 'application/octet-stream',
                    }, (error, response) => {
                        if (error) {
                            cb(error);
                            reject(error);
                        }
                        else {
                            resolve(response);
                        }
                    });
                });
            });
            // Placeholder image processing
            const placeholderImageRespond = new Promise((resolve, reject) => {
                const placeholderImage = clone.resize(placeholderSize, jimp_1.default.AUTO);
                const placeholderFilename = _filename + '_' + 'placeholder' + '.' + _output;
                const placeholder = `${dirPath}/${placeholderFilename}`;
                placeholderImage.getBuffer(this._getMime(), (err, buffer) => {
                    this.options.s3.upload({
                        Bucket: this.options.bucket,
                        Key: placeholder,
                        Body: streamifier_1.default.createReadStream(buffer),
                        //   ACL: this.options.acl,
                        ContentType: 'application/octet-stream',
                    }, (error, response) => {
                        if (error) {
                            cb(error);
                            reject(error);
                        }
                        else {
                            resolve(response);
                        }
                    });
                });
            });
            Promise.all([originalImageRespond, placeholderImageRespond]).then((valArray) => {
                const image = valArray[0].Key;
                const bucket = valArray[0].Bucket;
                const placeholder = valArray[1].Key;
                cb(null, {
                    mimetype: this._getMime(),
                    image,
                    placeholder,
                    bucket,
                });
            });
        });
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
        // fallback for options
        this.defaultOptions = {
            s3: null,
            bucket: null,
            acl: null,
            output: 'png',
            quality: 90,
            threshold: null,
            placeholderSize: 26,
        };
        // You can add more options
        const allowedOutputFormats = ['jpg', 'jpeg', 'png'];
        // If the option value is undefined or null it will fall back to the default option
        const allowedOutput = allowedOutputFormats === null || allowedOutputFormats === void 0 ? void 0 : allowedOutputFormats.includes((_b = String((_a = this.options.output) !== null && _a !== void 0 ? _a : this.defaultOptions.output)) === null || _b === void 0 ? void 0 : _b.toLowerCase());
        if (!allowedOutput)
            throw new Error('Output is not allowed');
        switch (typeof opts.s3) {
            case 'object':
                if (!this.options.acl)
                    throw new Error('Expected acl to be string');
                if (!this.options.bucket)
                    throw new Error('Expected bucket to be string');
                break;
            default:
                break;
        }
    }
}
exports.default = (opts) => {
    return new CustomStorageEngine(opts);
};
//# sourceMappingURL=storage.js.map