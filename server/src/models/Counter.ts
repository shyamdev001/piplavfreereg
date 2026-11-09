import { Schema, model } from 'mongoose';

export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model<ICounter>('Counter', counterSchema);

/**
 * Atomically increments and returns the next sequence value.
 * findOneAndUpdate with upsert is atomic at the MongoDB level, so this is
 * safe under concurrent lead creation across multiple agents/requests.
 */
export async function getNextSequence(key: string): Promise<number> {
  // Two requests creating the same new key at the same instant can both try to
  // insert it; the loser gets a duplicate-key error and simply retries the $inc.
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      ).lean();
      return doc!.seq;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000 || attempt >= 4) throw err;
    }
  }
}
