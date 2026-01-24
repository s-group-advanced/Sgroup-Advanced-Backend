export const getInvitationAcceptedTemplate = (data: {
  workspaceName: string;
  inviterName: string;
  acceptedAt: string;
  workspaceId: string;
  frontendUrl: string;
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ${data.workspaceName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
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
            background: #1a1a1a;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            animation: checkmark 0.5s ease-in-out;
        }
        @keyframes checkmark {
            0%, 50% {
                transform: scale(0);
            }
            100% {
                transform: scale(1);
            }
        }
        .checkmark {
            color: white;
            font-size: 32px;
            font-weight: bold;
        }
        h1 {
            color: #172b4d;
            font-size: 24px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .success-message {
            color: #5e6c84;
            font-size: 15px;
            margin-bottom: 28px;
        }
        .info-card {
            background: #f5f6f8;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
            text-align: left;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #dfe1e6;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            color: #5e6c84;
            font-size: 13px;
            font-weight: 500;
        }
        .info-value {
            color: #172b4d;
            font-size: 13px;
            font-weight: 600;
            max-width: 60%;
            text-align: right;
            word-break: break-word;
        }
        .btn {
            background: #1a1a1a;
            color: white;
            padding: 14px 32px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background 0.2s;
            margin-top: 24px;
        }
        .btn:hover {
            background: #000000;
        }
        .footer {
            margin-top: 24px;
            color: #5e6c84;
            font-size: 13px;
        }
        .countdown {
            color: #172b4d;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            <span class="checkmark">✓</span>
        </div>
        
        <h1>Welcome to ${data.workspaceName}</h1>
        <p class="success-message">You've successfully joined the workspace</p>
        
        <div class="info-card">
            <div class="info-row">
                <span class="info-label">Workspace</span>
                <span class="info-value">${data.workspaceName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Invited by</span>
                <span class="info-value">${data.inviterName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Joined at</span>
                <span class="info-value">${new Date(data.acceptedAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}</span>
            </div>
        </div>

        <a href="${data.frontendUrl}/workspaces/${data.workspaceId}" class="btn">
            Go to Workspace
        </a>

        <p class="footer">
            Redirecting in <span class="countdown" id="countdown">5</span> seconds...
        </p>
    </div>

    <script>
        let seconds = 5;
        const countdownEl = document.getElementById('countdown');
        const redirectUrl = '${data.frontendUrl}/workspaces/${data.workspaceId}';

        const interval = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds;
            
            if (seconds <= 0) {
                clearInterval(interval);
                window.location.href = redirectUrl;
            }
        }, 1000);
    </script>
</body>
</html>
  `;
};
