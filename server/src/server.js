import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;
createApp().listen(port, () => {
  console.log(`AIR Club server running on http://localhost:${port}`);
  console.log(`Emails: ${process.env.SEND_EMAILS === 'true' ? 'SENDING via SMTP' : 'console only (set SEND_EMAILS=true to send)'}`);
});
