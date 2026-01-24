export const getWorkspaceInvitationEmailTemplate = (data: {
  userName: string;
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
  rejectUrl: string;
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Invitation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f6f8;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        .header {
            background: #1a1a1a;
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 16px;
            color: #172b4d;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .message {
            color: #5e6c84;
            line-height: 1.6;
            margin-bottom: 24px;
            font-size: 14px;
        }
        .workspace-info {
            background: #f5f6f8;
            padding: 20px;
            border-radius: 6px;
            margin: 24px 0;
            border-left: 3px solid #1a1a1a;
        }
        .workspace-info p {
            margin: 8px 0;
            color: #172b4d;
            font-size: 14px;
        }
        .workspace-info strong {
            color: #1a1a1a;
            font-weight: 600;
        }
        .button-group {
            text-align: center;
            margin: 32px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 28px;
            margin: 0 6px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            font-size: 14px;
            transition: all 0.2s;
        }
        .btn-accept {
            background: #1a1a1a;
            color: white;
        }
        .btn-accept:hover {
            background: #000000;
        }
        .btn-reject {
            background: #f5f6f8;
            color: #5e6c84;
            border: 1px solid #dfe1e6;
        }
        .btn-reject:hover {
            background: #ebecf0;
        }
        .footer {
            text-align: center;
            padding: 24px;
            color: #5e6c84;
            font-size: 13px;
            border-top: 1px solid #ebecf0;
        }
        .link-fallback {
            margin-top: 24px;
            padding: 16px;
            background: #f5f6f8;
            border-radius: 4px;
            font-size: 12px;
            color: #5e6c84;
        }
        .link-fallback a {
            color: #1a1a1a;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Workspace Invitation</h1>
        </div>
        
        <div class="content">
            <p class="greeting">Hi ${data.userName},</p>
            
            <p class="message">
                <strong>${data.inviterName}</strong> has invited you to collaborate on:
            </p>
            
            <div class="workspace-info">
                <p><strong>Workspace:</strong> ${data.workspaceName}</p>
                <p><strong>Invited by:</strong> ${data.inviterName}</p>
            </div>
            
            <p class="message">
                Accept the invitation to start working together on boards, lists, and cards.
            </p>
            
            <div class="button-group">
                <a href="${data.acceptUrl}" class="btn btn-accept">
                    Accept Invitation
                </a>
                <a href="${data.rejectUrl}" class="btn btn-reject">
                    Decline
                </a>
            </div>
            
            <div class="link-fallback">
                <p style="margin: 0 0 8px 0; font-weight: 500; color: #172b4d;">If buttons don't work:</p>
                <p style="margin: 4px 0;">Accept: <a href="${data.acceptUrl}">${data.acceptUrl}</a></p>
                <p style="margin: 4px 0;">Decline: <a href="${data.rejectUrl}">${data.rejectUrl}</a></p>
            </div>
        </div>
        
        <div class="footer">
            <p>This invitation expires in 3 days</p>
            <p style="margin-top: 8px;">© ${new Date().getFullYear()} Trello Clone. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
};
