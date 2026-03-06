export default async function handler(request: Request): Promise<Response> {
  const payload = await request.json();

  return Response.json({
    status: 'stubbed',
    action: 'calendar-create',
    payload
  });
}
