"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarStorage = void 0;
// Load dependencies
const lodash_1 = __importDefault(require("lodash"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const jimp_1 = __importDefault(require("jimp"));
const crypto_1 = __importDefault(require("crypto"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const concat_stream_1 = __importDefault(require("concat-stream"));
const streamifier_1 = __importDefault(require("streamifier"));
// Configure UPLOAD_PATH
const UPLOAD_PATH = path_1.default.resolve('tmp'); //path.resolve(__dirname, '..', 'public/photos');
// Configure UPLOAD_PATH
// process.env.AVATAR_STORAGE contains uploads/avatars
// create a multer storage engine
const AvatarStorage = function (options) {
    console.log('options:>', options);
    // this serves as a constructor
    function AvatarStorage(opts) {
        console.log('opts:>', opts);
        const baseUrl = process.env.AVATAR_BASE_URL;
        const allowedStorageSystems = ['local'];
        const allowedOutputFormats = ['jpg', 'png'];
        // fallback for the options
        const defaultOptions = {
            storage: 'local',
            output: 'png',
            greyscale: false,
            quality: 70,
            square: true,
            threshold: 500,
            responsive: true,
        };
        // extend default options with passed options
        let options = opts && lodash_1.default.isObject(opts) ? lodash_1.default.pick(opts, lodash_1.default.keys(defaultOptions)) : {};
        options = lodash_1.default.extend(defaultOptions, options);
        // check the options for correct values and use fallback value where necessary
        this.options = lodash_1.default.forIn(options, function (value, key, object) {
            switch (key) {
                case 'square':
                case 'greyscale':
                case 'responsive':
                    object[key] = lodash_1.default.isBoolean(value) ? value : defaultOptions[key];
                    break;
                case 'storage':
                    value = String(value).toLowerCase();
                    object[key] = lodash_1.default.includes(allowedStorageSystems, value)
                        ? value
                        : defaultOptions[key];
                    break;
                case 'output':
                    value = String(value).toLowerCase();
                    object[key] = lodash_1.default.includes(allowedOutputFormats, value)
                        ? value
                        : defaultOptions[key];
                    break;
                case 'quality':
                    value = lodash_1.default.isFinite(value) ? value : Number(value);
                    object[key] =
                        value && value >= 0 && value <= 100 ? value : defaultOptions[key];
                    break;
                case 'threshold':
                    value = lodash_1.default.isFinite(value) ? value : Number(value);
                    object[key] = value && value >= 0 ? value : defaultOptions[key];
                    break;
            }
        });
        // set the upload path
        this.uploadPath = UPLOAD_PATH;
        // this.options.responsive
        //   ? path.join(UPLOAD_PATH, 'responsive')
        //   : UPLOAD_PATH;
        // set the upload base url
        this.uploadBaseUrl = UPLOAD_PATH;
        // this.options.responsive
        //   ? path.join(baseUrl, 'responsive')
        //   : baseUrl;
        if (this.options.storage == 'local') {
            // if upload path does not exist, create the upload path structure
            !fs_1.default.existsSync(this.uploadPath) && mkdirp_1.default.sync(this.uploadPath);
        }
    }
    // this generates a random cryptographic filename
    AvatarStorage.prototype._generateRandomFilename = function () {
        // create pseudo random bytes
        let bytes = crypto_1.default.pseudoRandomBytes(32);
        // create the md5 hash of the random bytes
        let checksum = crypto_1.default.createHash('MD5').update(bytes).digest('hex');
        // return as filename the hash with the output extension
        return checksum + '.' + this.options.output;
    };
    // this creates a Writable stream for a filepath
    AvatarStorage.prototype._createOutputStream = function (filepath, cb) {
        console.log('_createOutputStream ========>', { filepath, cb });
        // create a reference for this to use in local functions
        let that = this;
        // create a writable stream from the filepath
        let output = fs_1.default.createWriteStream(filepath);
        // set callback fn as handler for the error event
        output.on('error', cb);
        // set handler for the finish event
        output.on('finish', function () {
            cb(null, {
                destination: that.uploadPath,
                baseUrl: that.uploadBaseUrl,
                filename: path_1.default.basename(filepath),
            });
        });
        // return the output stream
        return output;
    };
    // this processes the Jimp image buffer
    AvatarStorage.prototype._processImage = function (image, cb) {
        console.log('{image, cb}:>', { image, cb });
        // create a reference for this to use in local functions
        let that = this;
        let batch = [];
        // the responsive sizes
        let sizes = ['lg', 'md', 'sm'];
        let filename = this._generateRandomFilename();
        let mime = jimp_1.default.MIME_PNG;
        // create a clone of the Jimp image
        let clone = image.clone();
        // fetch the Jimp image dimensions
        let width = clone.bitmap.width;
        let height = clone.bitmap.height;
        let square = Math.min(width, height);
        let threshold = this.options.threshold;
        // resolve the Jimp output mime type
        switch (this.options.output) {
            case 'jpg':
                mime = jimp_1.default.MIME_JPEG;
                break;
            case 'png':
            default:
                mime = jimp_1.default.MIME_PNG;
                break;
        }
        // auto scale the image dimensions to fit the threshold requirement
        if (threshold && square > threshold) {
            clone =
                square == width
                    ? clone.resize(threshold, jimp_1.default.AUTO)
                    : clone.resize(jimp_1.default.AUTO, threshold);
        }
        // crop the image to a square if enabled
        if (this.options.square) {
            if (threshold) {
                square = Math.min(square, threshold);
            }
            // fetch the new image dimensions and crop
            clone = clone.crop((clone.bitmap.width - square) / 2, (clone.bitmap.height - square) / 2, square, square);
        }
        // convert the image to greyscale if enabled
        if (this.options.greyscale) {
            clone = clone.greyscale();
        }
        // set the image output quality
        clone = clone.quality(this.options.quality);
        if (this.options.responsive) {
            // map through  the responsive sizes and push them to the batch
            batch = lodash_1.default.map(sizes, function (size) {
                let outputStream;
                let image = null;
                let filepath = filename.split('.');
                // create the complete filepath and create a writable stream for it
                filepath = filepath[0] + '_' + size + '.' + filepath[1];
                filepath = path_1.default.join(that.uploadPath, filepath);
                outputStream = that._createOutputStream(filepath, cb);
                // scale the image based on the size
                switch (size) {
                    case 'sm':
                        image = clone.clone().scale(0.3);
                        break;
                    case 'md':
                        image = clone.clone().scale(0.7);
                        break;
                    case 'lg':
                        image = clone.clone();
                        break;
                }
                // return an object of the stream and the Jimp image
                return {
                    stream: outputStream,
                    image: image,
                };
            });
        }
        else {
            // push an object of the writable stream and Jimp image to the batch
            batch.push({
                stream: that._createOutputStream(path_1.default.join(that.uploadPath, filename), cb),
                image: clone,
            });
        }
        // process the batch sequence
        lodash_1.default.each(batch, function (current) {
            // get the buffer of the Jimp image using the output mime type
            current.image.getBuffer(mime, function (err, buffer) {
                if (that.options.storage == 'local') {
                    // create a read stream from the buffer and pipe it to the output stream
                    streamifier_1.default.createReadStream(buffer).pipe(current.stream);
                }
            });
        });
    };
    // multer requires this for handling the uploaded file
    AvatarStorage.prototype._handleFile = function (req, file, cb) {
        console.log('{file, cb}:>', { file, cb });
        // create a reference for this to use in local functions
        let that = this;
        // create a writable stream using concat-stream that will
        // concatenate all the buffers written to it and pass the
        // complete buffer to a callback fn
        let fileManipulate = (0, concat_stream_1.default)(function (imageData) {
            // read the image buffer with Jimp
            // it returns a promise
            jimp_1.default.read(imageData)
                .then(function (image) {
                // process the Jimp image buffer
                that._processImage(image, cb);
            })
                .catch(cb);
        });
        // write the uploaded file buffer to the fileManipulate stream
        file.stream.pipe(fileManipulate);
    };
    // multer requires this for destroying file
    AvatarStorage.prototype._removeFile = function (req, file, cb) {
        console.log('{ file, cb}:>', { file, cb });
        let matches, pathsplit;
        let filename = file.filename;
        let _path = path_1.default.join(this.uploadPath, filename);
        let paths = [];
        // delete the file properties
        delete file.filename;
        delete file.destination;
        delete file.baseUrl;
        delete file.storage;
        // create paths for responsive images
        if (this.options.responsive) {
            pathsplit = _path.split('/');
            matches = pathsplit.pop().match(/^(.+?)_.+?\.(.+)$/i);
            if (matches) {
                paths = lodash_1.default.map(['lg', 'md', 'sm'], function (size) {
                    return (pathsplit.join('/') +
                        '/' +
                        (matches[1] + '_' + size + '.' + matches[2]));
                });
            }
        }
        else {
            paths = [_path];
        }
        // delete the files from the filesystem
        lodash_1.default.each(paths, function (_path) {
            fs_1.default.unlink(_path, cb);
        });
    };
    // create a new instance with the passed options and return it
    return new AvatarStorage(options);
};
exports.AvatarStorage = AvatarStorage;
//# sourceMappingURL=PhotoStorage.js.map