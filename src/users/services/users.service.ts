import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { UpdateUserDto } from '../dto';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async findById(id: number): Promise<Omit<User, 'password' | 'verification_token'>> {
    console.log('Service findById called with:', id, 'Type:', typeof id);

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

    console.log('Query result:', user ? 'Found user' : 'No user found');

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

    console.log('Found users count:', users.length);
    console.log(
      'User IDs:',
      users.map((u) => ({ id: u.id, type: typeof u.id })),
    );

    return users;
  }

  async updateById(id: number, updateUserDto: UpdateUserDto): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id, is_deleted: false } });
    if (!user) {
      throw new NotFoundException('User not found');
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
      const { password, verification_token, ...userWithoutSensitive } = user;
      password;
      verification_token;
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

  async deleteById(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id, is_deleted: false } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.is_deleted = true;
    await this.userRepository.save(user);
  }
}
