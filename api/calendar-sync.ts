export default async function handler(): Promise<Response> {
  return Response.json({
    status: 'stubbed',
    action: 'calendar-sync'
  });
}
