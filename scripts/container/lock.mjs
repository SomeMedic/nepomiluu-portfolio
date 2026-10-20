const action = process.argv[2];
if (!['lock', 'unlock', 'status'].includes(action)) throw new Error('Unknown backup lock operation');
let stdin = '';
if (action === 'unlock') for await (const chunk of process.stdin) stdin += chunk;
const body = action === 'unlock' ? JSON.parse(stdin) : { ttlSeconds: Number(process.argv[3] || 900) };
const response = await fetch(`http://127.0.0.1:${process.env.API_PORT || 4000}/api/internal/backup/${action}`, {
  method: action === 'status' ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', 'x-internal-secret': process.env.INTERNAL_SECRET || '' },
  ...(action === 'status' ? {} : { body: JSON.stringify(body) }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Backup ${action} failed (${response.status})`);
process.stdout.write(JSON.stringify(await response.json()));
