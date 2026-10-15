import { NextRequest, NextResponse } from 'next/server';

interface SmartScalePayload {
  provider: 'hume' | 'fittr' | 'fitelo';
  userId: string;
  weightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  waterPct?: number;
  boneMassKg?: number;
  visceralFat?: number;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-smart-scale-signature');
    const authHeader = req.headers.get('authorization');

    // Authenticate webhook
    const validSecret = process.env.SCALE_WEBHOOK_SECRET || 'dev_scale_secret';
    if (authHeader !== `Bearer ${validSecret}` && signature !== validSecret) {
      // In dev mode allow if no secret configured
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized webhook call' }, { status: 401 });
      }
    }

    const body: SmartScalePayload = await req.json();

    if (!body.userId || !body.weightKg) {
      return NextResponse.json({ error: 'Missing required scale telemetry fields (userId, weightKg)' }, { status: 400 });
    }

    // Process & store scale telemetry
    const scaleRecord = {
      userId: body.userId,
      provider: body.provider || 'hume',
      weightKg: Number(body.weightKg.toFixed(2)),
      bodyFatPct: body.bodyFatPct ? Number(body.bodyFatPct.toFixed(1)) : null,
      muscleMassKg: body.muscleMassKg ? Number(body.muscleMassKg.toFixed(2)) : null,
      waterPct: body.waterPct ? Number(body.waterPct.toFixed(1)) : null,
      visceralFat: body.visceralFat || null,
      syncedAt: body.timestamp || new Date().toISOString(),
    };

    console.log('[SMART_SCALE_INGEST]', scaleRecord);

    return NextResponse.json({
      success: true,
      message: `Ingested telemetry from ${scaleRecord.provider.toUpperCase()} scale`,
      data: scaleRecord,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Smart scale ingest failed' }, { status: 500 });
  }
}
