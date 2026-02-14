import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Get,
  Query,
  Res,
  Req,
  Patch,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdatePasswordDto,
} from '../dto';
import { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async login(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(loginDto);

    const isProd = process.env.NODE_ENV === 'production';
    // Set HttpOnly cookies for tokens
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      maxAge: result.expires_in * 1000,
      path: '/',
    });
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      // 7 days
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return result;
  }

  // login with google oauth2

  // Route to FE call: start login with google
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  // Route receive callback from google
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const { access_token, refresh_token } = await this.authService.handleGoogleLogin(
      (req as any).user,
    );

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = this.configService.get<string>('FE_URL');
    return res.redirect(`${frontendUrl}/oauth-callback?token=${access_token}`);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User registration' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async register(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    registerDto: RegisterDto,
  ): Promise<{ message: string; email: string }> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiQuery({ name: 'token', description: 'Verification token from email' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    try {
      const result = await this.authService.verifyEmail(token);

      if (result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }

      return res.json(result);
    } catch (error) {
      const frontendUrl =
        this.configService.get<string>('FE_URL') || 'http://localhost:5173/react-app';
      const errorMessage =
        error instanceof BadRequestException ? error.message : 'Email verification failed';

      return res.redirect(
        `${frontendUrl}/verify-error?message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
      },
      required: ['email'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Email already verified',
  })
  async resendVerification(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: {
      email: string;
    },
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(body.email);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async refreshToken(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    // Allow using cookie if body is empty/missing
    const tokenFromCookie = (req as any).cookies?.refresh_token as string | undefined;
    const effectiveDto: RefreshTokenDto = {
      refresh_token: refreshTokenDto.refresh_token || tokenFromCookie || '',
    };

    const result = await this.authService.refreshToken(effectiveDto);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      maxAge: result.expires_in * 1000,
      path: '/',
    });

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      // 7 days
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear auth cookies' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ message: string }> {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      path: '/',
    });
    return { message: 'Logged out' };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update password for authenticated user' })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password or validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePassword(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    { current_password, new_password, confirm_password }: UpdatePasswordDto,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    if (!user || !user.sub) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.authService.updatePassword(
      user.sub,
      current_password,
      new_password,
      confirm_password,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset link sent if email exists' })
  async forgotPassword(@Body() { email }: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Get('reset-password')
  @ApiOperation({ summary: 'Validate reset password token and redirect to FE' })
  @ApiQuery({ name: 'token', description: 'Reset password token' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend' })
  async validateResetPasswordToken(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.validateResetToken(token);

    if (result.redirectUrl) {
      res.redirect(result.redirectUrl);
    }
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() { token, new_password, confirm_password }: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(token, new_password, confirm_password);
  }
}
