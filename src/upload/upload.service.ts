import { BadRequestException, Injectable } from '@nestjs/common';
import cloudinary from 'src/common/config/cloudinary.config';
import { GenerateCardAttachmentSignatureDto } from './dtos/generate-card-attachment-signature.dto';

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

  // Upload card attachment signature
  async generateCardAttachmentSignature(userId: string, dto: GenerateCardAttachmentSignatureDto) {
    // Validate mime/extension allowlist
    const allowedMime = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/zip',
    ]);
    if (!allowedMime.has(dto.mimeType)) {
      throw new BadRequestException('File type is not allowed');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const safeName = dto.fileName.replace(/[^\w.-]/g, '_');
    const baseName = safeName.replace(/\.[^/.]+$/, '');
    const publicId = `${Date.now()}_${baseName}`;
    const uploadParams = {
      timestamp,
      folder: `card-attachments/${dto.cardId}`,
      public_id: publicId,
      resource_type: 'raw',
      tags: `card:${dto.cardId},uploader:${userId}`,
      access_mode: 'public',
    };
    const toSign = {
      timestamp,
      folder: `card-attachments/${dto.cardId}`,
      public_id: publicId,
      access_mode: 'public',
    };
    const signature = cloudinary.utils.api_sign_request(
      toSign,
      process.env.CLOUDINARY_API_SECRET as string,
    );
    return {
      signature,
      timestamp,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      folder: uploadParams.folder,
      public_id: uploadParams.public_id,
      resource_type: 'raw',
      access_mode: uploadParams.access_mode,
      upload_url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
    };
  }
}
