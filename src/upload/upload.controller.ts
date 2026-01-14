import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

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
}
