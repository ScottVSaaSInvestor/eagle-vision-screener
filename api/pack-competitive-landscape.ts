import { adapt } from './_adapter';
import { handler } from '../netlify/functions/pack-competitive-landscape';
export default adapt(handler);
export const config = { maxDuration: 300 };
