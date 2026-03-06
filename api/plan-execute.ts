export default async function handler(request: Request): Promise<Response> {
  const payload = await request.json();

  return Response.json({
    status: 'stubbed',
    action: 'plan-execute',
    executionMode: payload?.mode ?? 'calendar_description'
  });
}
