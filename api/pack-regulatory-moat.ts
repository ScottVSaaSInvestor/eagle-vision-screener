import { adapt } from './_adapter';
import { handler } from '../netlify/functions/pack-regulatory-moat';
export default adapt(handler);
export const config = { maxDuration: 300 };
