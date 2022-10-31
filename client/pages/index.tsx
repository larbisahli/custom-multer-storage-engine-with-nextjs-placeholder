import type { NextPage } from 'next';
import { useDropzone } from 'react-dropzone';
import { useState } from 'react';
import ImageComponent from '@components/ImageComponent';

interface ImageType {
  bucket: string;
  image: string;
  mimeType: string;
  originalname: string;
  placeholder: string;
}

const Home: NextPage = () => {
  const [images, setImages] = useState<ImageType[]>([]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    multiple: true,
    maxSize: 5 * (1024 * 1024),
    onDrop: async (acceptedFiles) => {
      try {
        for await (const file of acceptedFiles) {
          var formData = new FormData();
          formData.append('photo', file);
          fetch('http://127.0.0.1:5000/upload', {
            method: 'POST',
            body: formData,
          }).then(async (e) => {
            const img = (await e.json()) as ImageType;
            setImages((prev) => [...prev, img]);
            console.log('------ :>> ', img);
          });
        }
      } catch (error) {
        console.log('error :>> ', error);
      }
    },
  });

  return (
    <div className="container">
      <section className="main">
        <div {...getRootProps({ className: 'upload' })}>
          <input {...getInputProps()} />
          <p>{"Drag 'n' drop some files here, or click to select files"}</p>
        </div>

        <div className="gallery-container">
          <div className="gallery-title">Uploaded Images</div>
          <div className="gallery-wrapper">
            {images?.map((img, i) => {
              return (
                <div key={i} className="gallery-image">
                  <ImageComponent
                    src={img.image}
                    customPlaceholder={img.placeholder}
                    layout="fill"
                    objectFit="cover"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
