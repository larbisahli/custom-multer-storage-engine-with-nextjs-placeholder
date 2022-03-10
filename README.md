## A Custom Multer Storage Engine in Express with Nextjs Image placeholder

We will be creating a custom Multer Storage Engine to upload an image and a placeholder that we will use for Nextjs Image component.

We are going to use the following packages to build our application:

- express: A very popular Node server.
- multer: A package for extracting files from multipart/form-data requests.
- jimp: An image manipulation package.
- dotenv: A package for adding .env variables to process.env.
- aws-sdk: A package for uploading images to s3 bucket.
- concat-stream: A package for creating a writable stream that concatenates all the data from a stream and calls a callback with the result.
- streamifier: A package to convert a Buffer/String into a readable stream.

Creating the Multer Storage Engine create the handler for the upload request. We are going to implement the `/upload` route to actually handle the upload and we will be using the Multer package for that.

```typescript
// server.ts
import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import Storage from "./helpers/storage";
import AWS from "aws-sdk";

dotenv.config();

const app: Application = express();

// Set S3 endpoint
const spacesEndpoint = new AWS.Endpoint(process.env.SPACES_BUCKET_ENDPOINT);

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
  secretAccessKey: process.env.SPACES_ACCESS_SECRET_KEY,
});

app.use(cors());

app.use("/media", express.static("public"));

// setup a new instance of the AvatarStorage engine
const storage = Storage({
  s3,
  bucket: process.env.SPACES_BUCKET_NAME,
  acl: "public-read",
  threshold: 1000,
  storage: "locale",
  dir: "public",
  output: "jpg",
});

const limits = {
  files: 1, // allow only 1 file per request
  fileSize: 5 * (1024 * 1024), // 10 MB (max file size)
};

// setup multer
const upload = multer({
  storage,
  limits: limits,
});

interface CustomFileResult extends Partial<Express.Multer.File> {
  image: string;
  placeholder: string;
  bucket?: string;
}

app.post("/upload", upload.single("photo"), function (req, res) {
  const file = req.file as CustomFileResult;
  const { mimetype, originalname, image, placeholder, bucket } = file;
  res.json({ mimetype, originalname, image, placeholder, bucket });
});

const PORT = 5000;

app.listen(PORT, function () {
  console.log(`Express Server started on port ${PORT}`);
});
```

The filename for normal image and its placeholder takes the format `[generated_filename]_placeholder.[output_extension]`
and `[generated_filename].[output_extension]` Then the image clone and the stream are put in a batch for processing.

### Creating the Multer Storage Engine

We will have to create a custom storage engine to use with Multer. Let’s create a new folder in our project root named helpers and create a new file storage.ts inside it for our custom storage engine. The file should contain the following blueprint code snippet:

```typescript
// storage.ts

// Load dependencies
import { Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Jimp from "jimp";
import concat from "concat-stream";
import streamifier from "streamifier";
import slugify from "slugify";
import { customAlphabet } from "nanoid";
import type AWS from "aws-sdk";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz", 10);

const PNG = "png";
const JPEG = "jpeg" || "jpg";
const typeS3 = "s3";
const typeLocal = "locale";

type nameFnType = (
  file: Express.Multer.File,
  output: typeof PNG | typeof JPEG
) => string;

type Options = {
  s3: AWS.S3 | null;
  bucket: string | null;
  acl: string;
  output?: typeof PNG | typeof JPEG;
  storage?: typeof typeS3 | typeof typeLocal;
  quality?: number;
  threshold?: number | null;
  placeholderSize?: number;
  dir: string;
};

interface CustomFileResult extends Partial<Express.Multer.File> {
  image: string;
  placeholder: string;
  bucket?: string;
}

class CustomStorageEngine implements multer.StorageEngine {
  defaultOptions: Options;
  options: Options;
  placeholder: string;
  image: string;
  filepath: string;
  fileSharedName: string;

  constructor(opts: Options) {
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
      output: "png",
      storage: "locale",
      quality: 90,
      threshold: null,
      placeholderSize: 26,
    };

    // You can add more options
    const allowedOutputFormats = ["jpg", "jpeg", "png"];

    if (this.options.dir && !fs.existsSync(this.options.dir)) {
      fs.mkdirSync(this.options.dir);
    }

    // If the option value is undefined or null it will fall back to the default option
    const allowedOutput = allowedOutputFormats?.includes(
      String(this.options.output ?? this.defaultOptions.output)?.toLowerCase()
    );

    if (!allowedOutput) throw new Error("Output is not allowed");
    if (!this.options.dir) throw new Error("Expected dir to be string");

    switch (typeof opts.s3) {
      case "object":
        if (!this.options.acl) throw new Error("Expected acl to be string");
        if (!this.options.bucket)
          throw new Error("Expected bucket to be string");
        break;
      default:
        if (this.options.storage === typeS3)
          throw new TypeError("Expected opts.s3 to be object");
        break;
    }
  }

  // Create a file path based on date
  private getPath = () => {
    const newDate = new Date();
    const Month = newDate.getMonth() + 1;
    const Year = newDate.getFullYear();

    const dir = this.options.dir ?? this.defaultOptions.dir;
    const dirPath = `${Year}/${Month}`;

    const filePath = path.resolve(`${dir}/${Year}/${Month}`);

    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }

    return { dirPath, filePath };
  };

  private _getMime = () => {
    // resolve the Jimp output mime type
    const output = this.options.output ?? this.defaultOptions.output;
    switch (output) {
      case "jpg":
      case "jpeg":
        return Jimp.MIME_JPEG;
      case "png":
        return Jimp.MIME_PNG;
      default:
        return Jimp.MIME_PNG;
    }
  };

  // return as filename with the output extension
  private generateFilename: nameFnType = (
    file: Express.Multer.File,
    output: typeof PNG | typeof JPEG
  ) => {
    const newDate = new Date();
    const DateAsInt = Math.round(newDate.getTime() / 1000); // in seconds

    // trim a file extension from image and remove any possible dots in file name
    const filename = file?.originalname
      ?.replace(/\.[^/.]+$/, "")
      ?.replace(/\./g, "");

    if (filename) {
      const cleanedTitle = slugify(
        filename.replace(/[^A-Za-z0-9\s!?]/g, "").trim(),
        "_"
      );
      return (
        (cleanedTitle + "__" + DateAsInt + "_" + nanoid())?.toLowerCase() +
        "." +
        output
      );
    }
    return (DateAsInt + "_" + nanoid())?.toLowerCase() + "." + output;
  };

  _createOutputStream = (
    filepath: string,
    cb: (error?: Error | null, info?: CustomFileResult) => void
  ) => {
    const output = fs.createWriteStream(filepath);

    // set callback fn as handler for the error event
    output.on("error", cb);

    // set handler for the finish event
    output.on("finish", () => {
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

  private writeImage = (
    filepath: string,
    image: Jimp,
    cb: (error?: Error, info?: CustomFileResult) => void,
    { isPlaceholder }: { isPlaceholder: boolean }
  ) => {
    try {
      // get the buffer of the Jimp image using the output mime type
      image.getBuffer(this._getMime(), (err, buffer) => {
        const storage = this.options.storage ?? this.defaultOptions.storage;

        switch (storage) {
          case typeLocal: {
            // create a writable stream for it
            const outputStream = this._createOutputStream(filepath, cb);
            // create a read stream from the buffer and pipe it to the output stream
            streamifier.createReadStream(buffer).pipe(outputStream);
            break;
          }
          case typeS3:
            this.options.s3.upload(
              {
                Bucket: this.options.bucket,
                Key: isPlaceholder ? this.placeholder : this.image,
                Body: streamifier.createReadStream(buffer),
                ACL: this.options.acl,
                ContentType: "application/octet-stream",
              },
              (error, response) => {
                if (!error) {
                  cb(null, {
                    destination: this.filepath,
                    mimetype: this._getMime(),
                    image: this.image,
                    placeholder: this.placeholder,
                    bucket: response.Bucket,
                  });
                } else {
                  cb(error);
                }
              }
            );
            break;
          default:
            break;
        }
      });
    } catch (error) {
      console.log("error :>", error);
    }
  };

  _processImage = (
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
    this.fileSharedName = filename;

    // create a clone of the Jimp image
    let clone = image.clone();

    // Auto scale the image dimensions to fit the threshold requirement
    if (threshold) {
      clone = clone.resize(threshold, Jimp.AUTO);
    }

    // Set the image output quality
    clone = clone.quality(quality);

    const filenameSplit = filename.split(".");
    const _filename = filenameSplit[0];
    const _output = filenameSplit[1];

    const { filePath, dirPath } = this.getPath();

    this.filepath = filePath;

    // Original image processing
    const originalImage = clone.clone();
    const originalFilename = _filename + "." + _output;
    // Set original image upload path
    this.image = `${dirPath}/${originalFilename}`;
    // create the complete filepath
    const originalFilepath = path.join(this.filepath, originalFilename);
    this.writeImage(originalFilepath, originalImage, cb, {
      isPlaceholder: false,
    });

    // Placeholder image processing
    const placeholderImage = clone.resize(placeholderSize, Jimp.AUTO);
    const placeholderFilename = _filename + "_" + "placeholder" + "." + _output;
    // Set placeholder image upload path
    this.placeholder = `${dirPath}/${placeholderFilename}`;
    // create the complete filepath
    const placeholderFilepath = path.join(this.filepath, placeholderFilename);
    this.writeImage(placeholderFilepath, placeholderImage, cb, {
      isPlaceholder: true,
    });
  };

  _handleFile = (
    req: Request,
    file: Express.Multer.File,
    cb: (error?: Error | null, info?: CustomFileResult) => void
  ): void => {
    // create a writable stream using concat-stream that will
    // concatenate all the buffers written to it and pass the
    // complete buffer to a callback fn
    const fileManipulate = concat((imageData) => {
      // read the image buffer with Jimp
      // returns a promise
      Jimp.read(imageData)
        .then((image) => {
          // process the Jimp image buffer
          this._processImage(image, cb, file);
        })
        .catch(cb);
    });

    // write the uploaded file buffer to the fileManipulate stream
    file.stream.pipe(fileManipulate);
  };

  _removeFile = (
    _req: Request,
    file: Express.Multer.File & { name: string },
    cb: (error: Error | null) => void
  ): void => {
    if (file.path) {
      fs.unlink(file.path, cb);
    }
    return;
  };
}

export default (opts: Options) => {
  return new CustomStorageEngine(opts);
};
```

## Nextjs Images placeholder

After we upload our image we received a response with the image path and it's placeholder.
Let's create a hook useGetDataUrl.ts to Fetch blob and convert the placeholder to base64.

```typescript
import { useEffect, useState } from "react";

export function useGetDataUrl(customPlaceholder: string) {
  const [Base64Placeholder, setBase64Placeholder] = useState<string>(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8+utrPQAJNQNlcqdyCgAAAABJRU5ErkJggg=="
  );

  useEffect(() => {
    async function toBase64() {
      try {
        const data = await fetch(customPlaceholder);
        const blob = await data.blob();

        // eslint-disable-next-line no-undef
        return await new Promise<string>((resolve) => {
          const reader = new window.FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64data = reader.result as string;
            return resolve(base64data);
          };
        })
          .then((res: string) => {
            setBase64Placeholder(res);
            return res;
          })
          .catch((error) => {
            console.log("error :>", error);
          });
      } catch (error) {
        console.log("error :>", error);
      }
    }

    if (customPlaceholder) {
      toBase64();
    }
  }, [customPlaceholder]);

  return Base64Placeholder;
}
```
