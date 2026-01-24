export const getInvitationRejectedTemplate = (data: {
  workspaceName: string;
  inviterName: string;
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation Declined</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f6f8;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            max-width: 500px;
            width: 100%;
            padding: 48px 40px;
            text-align: center;
            animation: slideIn 0.4s ease-out;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .icon {
            width: 64px;
            height: 64px;
            background: #5e6c84;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        .icon span {
            color: white;
            font-size: 32px;
        }
        h1 {
            color: #172b4d;
            font-size: 24px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        p {
            color: #5e6c84;
            line-height: 1.6;
            margin: 12px 0;
            font-size: 15px;
        }
        strong {
            color: #172b4d;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <span>✗</span>
        </div>
        <h1>Invitation Declined</h1>
        <p>You have declined the invitation to join <strong>${data.workspaceName}</strong>.</p>
        <p style="margin-top: 24px;">If this was a mistake, please contact <strong>${data.inviterName}</strong> for a new invitation.</p>
    </div>
</body>
</html>
  `;
};
