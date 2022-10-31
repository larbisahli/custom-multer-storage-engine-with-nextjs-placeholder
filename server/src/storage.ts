// storage.ts
import { Request } from 'express';
import multer from 'multer';
import Jimp from 'jimp';
import concat from 'concat-stream';
import streamifier from 'streamifier';
import { customAlphabet } from 'nanoid';
import type AWS from 'aws-sdk';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', 10);

const PNG = 'png';
const JPEG = 'jpeg' || 'jpg';

type nameFnType = (
  file: Express.Multer.File,
  output: typeof PNG | typeof JPEG
) => string;

type Options = {
  s3: AWS.S3 | null;
  bucket: string | null;
  acl: string;
  output?: typeof PNG | typeof JPEG;
  quality?: number;
  threshold?: number | null;
  placeholderSize?: number;
};

interface CustomFileResult extends Partial<Express.Multer.File> {
  image?: string;
  placeholder?: string;
  bucket?: string;
}

class CustomStorageEngine implements multer.StorageEngine {
  defaultOptions: Options;
  options: Options;
  placeholder: string
  image: string

  constructor(opts: Options) {
    this.options = opts || undefined;

    /**
     * Fallback for options
     */
    this.defaultOptions = {
      s3: null,
      bucket: null,
      acl: null,
      output: 'png',
      quality: 90,
      threshold: null,
      placeholderSize: 10,
    };

    // You can add more options
    const allowedOutputFormats = ['jpg', 'jpeg', 'png'];

    // If the option value is undefined or null it will fall back to the default options
    const allowedOutput = allowedOutputFormats?.includes(
      String(this.options.output ?? this.defaultOptions.output)?.toLowerCase()
    );

    if (!allowedOutput) throw new Error('Output is not allowed');

    switch (typeof opts.s3) {
      case 'object':
        if (!this.options.acl) throw new Error('Expected acl to be string');
        if (!this.options.bucket)
          throw new Error('Expected bucket to be string');
        break;
      default:
        break;
    }
  }

  /**
   *  Create a file path for s3 based on date
   * @return {string}
   */
  private getPath = () => {
    const newDate = new Date();
    const Month = newDate.getMonth() + 1;
    const Year = newDate.getFullYear();
    return `${Year}/${Month}`;
  };

  /**
   *  Get mime type
   * @return {"image/jpeg" | "image/png"}
   */
  private _getMime = () => {
    // Resolve the Jimp output mime type
    const output = this.options.output ?? this.defaultOptions.output;
    switch (output) {
      case 'jpg':
      case 'jpeg':
        return Jimp.MIME_JPEG;
      case 'png':
        return Jimp.MIME_PNG;
      default:
        return Jimp.MIME_PNG;
    }
  };

  /**
   * Returns a filename with the output extension
   * @param {Express.Multer.File} file
   * @param {typeof PNG | typeof JPEG} output
   * @returns {string}
   */
  private generateFilename: nameFnType = (
    file: Express.Multer.File,
    output: typeof PNG | typeof JPEG
  ) => {
    const newDate = new Date();
    const DateAsInt = Math.round(newDate.getTime() / 1000); // in seconds
    return (DateAsInt + '_' + nanoid())?.toLowerCase() + '.' + output;
  };

  _processImage = async (
    image: Jimp,
    cb: (error?: Error, info?: CustomFileResult) => void,
    file: Express.Multer.File
  ) => {
    // Get options
    const output = this.options.output ?? this.defaultOptions.output;
    const quality = this.options.quality ?? this.defaultOptions.quality;
    const threshold = this.options.threshold ?? this.defaultOptions.threshold;
    const placeholderSize =
      this.options.placeholderSize ?? this.defaultOptions.placeholderSize;

    const filename = this.generateFilename(file, output);

    // Create a clone of the Jimp image
    let clone: Jimp = image.clone();

    // Auto scale the image dimensions to fit the threshold requirement
    if (threshold) {
      clone = clone.resize(threshold, Jimp.AUTO);
    }

    // Set the image output quality
    clone = clone.quality(quality);

    const filenameSplit = filename.split('.');
    const _filename = filenameSplit[0];
    const _output = filenameSplit[1];

    const dirPath = this.getPath();

    // Original image processing
    const originalImageRespond = new Promise<AWS.S3.ManagedUpload.SendData>(
      (resolve, reject) => {
        const originalImage = clone.clone();
        const originalFilename = _filename + '.' + _output;
        const image = `${dirPath}/${originalFilename}`;

        try {
          originalImage.getBuffer(this._getMime(), (err, buffer) => {
            // Upload original image to s3
            this.options.s3.upload(
              {
                Bucket: this.options.bucket,
                Key: image,
                Body: streamifier.createReadStream(buffer),
                //   ACL: this.options.acl,
                ContentType: 'application/octet-stream',
              },
              (error, response) => {
                if (error) {
                  cb(error)
                  reject(error);
                } else {
                  resolve(response);
                }
              }
            );
          });
        } catch (error) {
          cb(error)
          reject(error);
        }
      }
    );

    // Placeholder image processing
    const placeholderImageRespond = new Promise<AWS.S3.ManagedUpload.SendData>(
      (resolve, reject) => {
        const placeholderImage = clone.resize(placeholderSize, Jimp.AUTO);
        const placeholderFilename =
          _filename + '_' + 'placeholder' + '.' + _output;
        const placeholder = `${dirPath}/${placeholderFilename}`;

        try {
          placeholderImage.getBuffer(this._getMime(), (err, buffer) => {
            // Upload placeholder image to s3
            this.options.s3.upload(
              {
                Bucket: this.options.bucket,
                Key: placeholder,
                Body: streamifier.createReadStream(buffer),
                //   ACL: this.options.acl,
                ContentType: 'application/octet-stream',
              },
              (error, response) => {
                if (error) {
                  cb(error)
                  reject(error);
                } else {
                  resolve(response);
                }
              }
            );
          });
        } catch (error) {
          cb(error)
          reject(error);
        }
      }
    );

    // Takes an iterable of promises as input and returns a single Promise
    // This returned promise fulfills when all of the input's promises fulfill
    Promise.all([originalImageRespond, placeholderImageRespond]).then(
      (valArray) => {
        const image = valArray[0].Key;
        const bucket = valArray[0].Bucket;
        const placeholder = valArray[1].Key;

        // Store the keys for later when there is an error and access them in _removeFile
        this.placeholder = this.placeholder ?? placeholder
        this.image = this.image ?? image

        cb(null, {
          mimetype: this._getMime(),
          image,
          placeholder,
          bucket,
        });
      }
    );
  };

  /**
   * Returns a filename with the output extension
   * @param {Express.Multer.File} file
   * @param {Request} req
   * @param {(error?: Error | null, info?: CustomFileResult) => void} cb
   * @returns {void}
   */
  _handleFile = (
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: CustomFileResult) => void
  ): void => {
    this.placeholder = null
    this.image = null
    // Create a writable stream using concat-stream that will
    // concatenate all the buffers written to it and pass the
    // complete buffer to a callback fn
    const fileManipulate = concat((imageData) => {
      // Read the image buffer with Jimp
      // Returns a promise
      Jimp.read(imageData)
      .then((image) => {
        // Process the Jimp image buffer
        this._processImage(image, cb, file);
      })
      .catch(cb);
    });

    // Write the uploaded file buffer to the fileManipulate stream
    file.stream.pipe(fileManipulate).on('error', cb)
  };

   /**
   * Remove files if an error is encountered later on
   * @param {Request} _req
   * @param {Express.Multer.File} file
   * @param {(error?: Error | null, info?: CustomFileResult) => void} cb
   * @returns {void}
   */
  _removeFile = (
    _req: Request,
    file: Express.Multer.File & { image: string, placeholder: string },
    cb: (error: Error | null) => void
  ): void => {
    console.log('file --> ', {file, image:this.image , placeholder:this.placeholder})
    this.options.s3.deleteObjects(
      {
        Bucket: this.options.bucket,
        Delete: {
          Objects: [{ Key: this.image }, { Key: this.placeholder }],
          Quiet: false,
        },
      },
      cb
    );
  };
}

export default (opts: Options) => {
  return new CustomStorageEngine(opts);
};