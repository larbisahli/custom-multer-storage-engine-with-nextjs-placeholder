import Image, { ImageProps } from 'next/image';
import React, { memo } from 'react';
import { useGetDataUrl } from '@hooks/useGetDataUrl';

interface Props extends ImageProps {
  customPlaceholder: string;
  src: string;
}

const ImageComponent = ({ src, customPlaceholder, ...props }: Props) => {
  const Base64Placeholder = useGetDataUrl(customPlaceholder);

  return (
    <Image
      blurDataURL={Base64Placeholder}
      placeholder="blur"
      alt={props.alt}
      src={src}
      {...props}
    />
  );
};

export default memo(ImageComponent);
