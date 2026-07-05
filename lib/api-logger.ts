import { prisma } from '@/lib/prisma';

export interface LogApiRequestParams {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  req?: Request | null;
  requestBody?: unknown;
  responseBody?: unknown;
  ip?: string;
  userAgent?: string;
}

export function logApiRequest(params: LogApiRequestParams): void {
  try {
    let ip = params.ip || '127.0.0.1';
    let userAgent = params.userAgent || 'Unknown';

    if (params.req) {
      const headers = params.req.headers;
      userAgent = headers.get('user-agent') || userAgent;
      const forwardedFor = headers.get('x-forwarded-for');
      if (forwardedFor) {
        ip = forwardedFor.split(',')[0].trim();
      } else {
        ip = headers.get('x-real-ip') || ip;
      }
    }

    let reqBodyStr: string | null = null;
    if (params.requestBody !== undefined && params.requestBody !== null) {
      reqBodyStr = typeof params.requestBody === 'string'
        ? params.requestBody
        : JSON.stringify(params.requestBody);
    }

    let resBodyStr: string | null = null;
    if (params.responseBody !== undefined && params.responseBody !== null) {
      resBodyStr = typeof params.responseBody === 'string'
        ? params.responseBody
        : JSON.stringify(params.responseBody);
    }

    // Fire and forget (Asynchronous logging without awaiting)
    prisma.apiLog.create({
      data: {
        method: params.method,
        path: params.path,
        status: params.status,
        durationMs: params.durationMs,
        ip,
        userAgent,
        requestBody: reqBodyStr,
        responseBody: resBodyStr,
      },
    }).catch((err) => {
      console.error('Failed to save API log:', err);
    });
  } catch (error) {
    console.error('Error in logApiRequest helper:', error);
  }
}
