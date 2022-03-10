import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import Storage from './helpers/Storage';
import AWS from 'aws-sdk';

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

app.use('/media', express.static('public'));

// setup a new instance of the AvatarStorage engine
const storage = Storage({
  s3,
  bucket: process.env.SPACES_BUCKET_NAME,
  acl: 'public-read',
  threshold: 1000,
  storage: 'locale',
  dir: 'public',
  output: 'jpg',
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

app.post('/upload', upload.single('photo'), function (req, res) {
  const file = req.file as CustomFileResult;

  console.log('<= req.file =>', file); // form files

  const { mimetype, originalname, image, placeholder, bucket } = file;
  res.json({ mimetype, originalname, image, placeholder, bucket });
});

const PORT = 5000;

app.listen(PORT, function () {
  console.log(`Express Server started on port ${PORT}`);
});
