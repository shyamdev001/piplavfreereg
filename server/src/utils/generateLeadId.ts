import { getNextSequence } from '../models/Counter';

const PREFIX = 'SOL';
const PAD_LENGTH = 6;

export async function generateLeadId(): Promise<string> {
  const seq = await getNextSequence('leadId');
  return `${PREFIX}-${String(seq).padStart(PAD_LENGTH, '0')}`;
}
