import { Injectable } from '@nestjs/common';
import cloudinary from 'src/common/config/cloudinary.config';

@Injectable()
export class UploadService {
  generateUploadSignature(userId: string) {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const uploadParams = {
      timestamp: timestamp,
      folder: `user-avatars/${userId}`,
    };

    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      process.env.CLOUDINARY_API_SECRET as string,
    );

    return {
      signature,
      timestamp,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      folder: uploadParams.folder,
    };
  }

  validateCloudinaryUrl(url: string, userId: string): any {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const expectedPrefix = `https://res.cloudinary.com/${cloudName}/image/upload`;
    const expectedFolder = `user-avatars/${userId}`;

    if (!url.startsWith(expectedPrefix)) {
      return false;
    }

    if (!url.includes(expectedFolder)) {
      return false;
    }

    return true;
  }
}
