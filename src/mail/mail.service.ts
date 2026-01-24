import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { getWorkspaceInvitationEmailTemplate } from 'src/workspaces/mail/workspaceInvitationEmailTemplate';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const verificationUrl = `${this.configService.get('APP_URL', 'http://localhost:5000')}/auth/verify-email?token=${token}`;

    try {
      this.mailerService.sendMail({
        to: email,
        subject: 'Xác thực tài khoản của bạn',
        template: 'verification',
        context: {
          name,
          verificationUrl,
        },
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      this.mailerService.sendMail({
        to: email,
        subject: 'Chào mừng đến với Sgroup!',
        template: 'welcome',
        context: {
          name,
        },
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  async sendResetPasswordEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.configService.get('APP_URL', 'http://localhost:5000')}/auth/reset-password?token=${token}`;

    try {
      this.mailerService.sendMail({
        to: email,
        subject: 'Reset your Sgroup password',
        template: 'reset-password',
        context: {
          name,
          email,
          resetUrl,
        },
      });
    } catch (error) {
      console.error('Failed to send reset password email:', error);
      throw error;
    }
  }

  async sendNotificationAddWorkspace(
    email: string,
    userName: string,
    workspaceName: string,
    inviterName: string,
    token: string,
  ): Promise<void> {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const acceptUrl = `${baseUrl}/api/workspaces/accept-invitation?token=${token}`;
    const rejectUrl = `${baseUrl}/api/workspaces/reject-invitation?token=${token}`;

    const html = getWorkspaceInvitationEmailTemplate({
      userName,
      workspaceName,
      inviterName,
      acceptUrl,
      rejectUrl,
    });

    await this.mailerService.sendMail({
      to: email,
      subject: `🎉 You've been invited to join ${workspaceName}`,
      html,
    });
  }

  async sendWelcomeToWorkspace(
    email: string,
    userName: string,
    workspaceName: string,
    userRole: string,
    invitedBy: string,
    workspaceId: string,
  ): Promise<void> {
    const workspaceUrl = `${this.configService.get('FE_URL', 'http://localhost:5173/react-app')}/workspaces/${workspaceId}`;

    try {
      this.mailerService.sendMail({
        to: email,
        subject: `Welcome to ${workspaceName}!`,
        template: 'welcome-to-workspace',
        context: {
          userName,
          workspaceName,
          userRole,
          invitedBy,
          workspaceUrl,
        },
      });
      console.log(`Welcome email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  async sendBoardInvitation(data: {
    board_name: string;
    invited_email: string;
    inviter_name: string;
    invitation_link: string;
  }): Promise<void> {
    try {
      this.mailerService.sendMail({
        to: data.invited_email,
        subject: `You've been invited to join ${data.board_name}`,
        template: 'board-invitation',
        context: {
          boardName: data.board_name,
          inviterName: data.inviter_name,
          invitationLink: data.invitation_link,
        },
      });
    } catch (error) {
      console.error('Failed to send board invitation email:', error);
    }
  }
}
