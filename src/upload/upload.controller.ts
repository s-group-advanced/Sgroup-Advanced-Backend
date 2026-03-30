import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { GenerateCardAttachmentSignatureDto } from './dtos/generate-card-attachment-signature.dto';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}
  @Post('signature')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // rate limit: 10 requests per minute
  async getUploadSignature(@Request() req: any) {
    const userId = req.user.sub;

    return this.uploadService.generateUploadSignature(userId);
  }

  @Post('signature/card-attachment')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getCardAttachmentSignature(
    @Request() req: any,
    @Body() dto: GenerateCardAttachmentSignatureDto,
  ) {
    return this.uploadService.generateCardAttachmentSignature(req.user.sub, dto);
  }
}
