export default function handler(_req: any, res: any) {
  return res.status(410).json({
    errorCode: 'LEGACY_VIETTEL_API_DISABLED',
    description: 'Use /api/viettel-config, /api/viettel-test, or /api/viettel-invoice.',
  });
}
