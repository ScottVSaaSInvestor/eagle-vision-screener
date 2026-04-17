import { adapt } from './_adapter';
import { handler } from '../netlify/functions/pack-data-architecture';
export default adapt(handler);
export const config = { maxDuration: 300 };
