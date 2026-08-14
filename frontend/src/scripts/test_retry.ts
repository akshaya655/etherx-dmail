import { sendMailInBackground } from '@/utils/backgroundSend';
import { getMails } from '@/utils/mailStore';

// Mock fetch to simulate SMTP failure for external recipients
const originalFetch = global.fetch;
global.fetch = async (url: string, opts: any) => {
  if (url.includes('/api/send-external')) {
    return {
      ok: false,
      statusText: 'Simulated failure',
      json: async () => ({ error: 'Simulated SMTP failure' })
    } as any;
  }
  return (originalFetch as any)(url, opts);
};

(async () => {
  const user = { email: 'test@etherxinnovations.in', password: 'dummy', publicKey: null, privateKey: null } as any;
  const recipient = 'external@example.com'; // triggers SMTP relay
  const mailId = await sendMailInBackground({
    user,
    recipientEmail: recipient,
    subject: 'Retry Test',
    message: 'This is a test for retry functionality',
    attachments: [],
    scheduleDate: undefined,
    scheduleTime: undefined,
    cc: '',
    bcc: '',
    threadId: undefined
  });
  console.log('Dispatched mail ID:', mailId);

  // Wait for background processing to complete
  setTimeout(() => {
    const outbox = getMails('outbox');
    console.log('Outbox entries after failure:', outbox);
  }, 3000);
})();
