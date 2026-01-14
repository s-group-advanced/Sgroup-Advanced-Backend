import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { UpdateUserDto } from '../dto';
import { MailService } from '../../mail/mail.service';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly uploadService: UploadService,
  ) {}

  async findById(id: string): Promise<Omit<User, 'password' | 'verification_token'>> {
    const user = await this.userRepository.findOne({
      where: { id, is_deleted: false },
      select: [
        'id',
        'email',
        'name',
        'avatar_url',
        'is_active',
        'is_deleted',
        'is_email_verified',
        'roles',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as Omit<User, 'password' | 'verification_token'>;
  }

  async findAll(): Promise<Omit<User, 'password' | 'verification_token'>[]> {
    const users = await this.userRepository.find({
      where: { is_deleted: false },
      select: [
        'id',
        'email',
        'name',
        'avatar_url',
        'is_active',
        'is_email_verified',
        'roles',
        'createdAt',
        'updatedAt',
      ],
    });

    return users;
  }

  async updateById(id: string, updateUserDto: UpdateUserDto): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id, is_deleted: false } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Defensive: do not allow clients to change primary id via body
    if ((updateUserDto as any).id && (updateUserDto as any).id !== id) {
      throw new BadRequestException('Cannot change user id');
    }

    // validate avatar url
    if (updateUserDto.avatar_url) {
      const isValid = this.uploadService.validateCloudinaryUrl(updateUserDto.avatar_url, id);

      if (!isValid) {
        throw new BadRequestException('Invalid avatar URL');
      }
    }

    // Check if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      // Check if new email already exists
      const existingUserWithEmail = await this.userRepository.findOne({
        where: { email: updateUserDto.email, is_deleted: false },
      });

      if (existingUserWithEmail) {
        throw new ConflictException('Email already in use by another user');
      }

      // Generate new verification token for the new email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date();
      verificationExpires.setHours(verificationExpires.getHours() + 24);

      // Update user with new email and reset verification status
      user.email = updateUserDto.email;
      user.is_email_verified = false;
      user.verification_token = verificationToken;
      user.verification_token_expires = verificationExpires;

      // Update other fields
      if (updateUserDto.name) user.name = updateUserDto.name;
      if (updateUserDto.avatar_url) user.avatar_url = updateUserDto.avatar_url;
      if (updateUserDto.is_active !== undefined) user.is_active = updateUserDto.is_active;

      await this.userRepository.save(user);

      // Send verification email to new email address
      await this.mailService.sendVerificationEmail(user.email, user.name, verificationToken);

      // Return user without password and verification_token
      const userWithoutSensitive: any = { ...user };
      delete userWithoutSensitive.password;
      delete userWithoutSensitive.verification_token;
      return {
        user: userWithoutSensitive,
        message: 'Email updated successfully. Please check your new email to verify your account.',
      };
    }

    // If email is not changed, just update other fields
    if (updateUserDto.name) user.name = updateUserDto.name;
    if (updateUserDto.avatar_url) user.avatar_url = updateUserDto.avatar_url;
    if (updateUserDto.is_active !== undefined) user.is_active = updateUserDto.is_active;

    await this.userRepository.save(user);
    return {
      user: user as Omit<User, 'password' | 'verification_token'>,
      message: null,
    };
  }

  async deleteById(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id, is_deleted: false } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.is_deleted = true;
    await this.userRepository.save(user);
  }
}
