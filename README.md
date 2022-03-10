## Advanced photo uploads in Express with Nextjs Image placeholder

We will create Multer Storage Engine to upload an image with a placeholder that we will use for Nextjs image component

We will be using the following packages to build our application:

- express: A very popular Node server.
- multer: A package for extracting files from multipart/form-data requests.
- jimp: An image manipulation package.
- dotenv: A package for adding .env variables to process.env.
- aws-sdk: A package for uploading images to s3 bucket.
- concat-stream: A package for creating a writable stream that concatenates all the data from a stream and calls a callback with the result.
- streamifier: A package to convert a Buffer/String into a readable stream.

Creating the Multer Storage Engine create the handler for the upload request. We are going to implement the /upload route to actually handle the upload and we will be using the Multer package for that.

The filename for normal image and its placeholder takes the format `[generated_filename]_placeholder.[output_extension]`
and `[generated_filename].[output_extension]` Then the image clone and the stream are put in a batch for processing.
