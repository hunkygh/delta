import { parseBrainDump } from '../src/utils/parseBrainDump';

export default async function handler(request: Request): Promise<Response> {
  const body = await request.json();
  const input = typeof body?.text === 'string' ? body.text : '';

  return Response.json({
    status: 'stubbed',
    proposal: parseBrainDump(input)
  });
}
