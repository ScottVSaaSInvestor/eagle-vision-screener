import { adapt } from './_adapter';
import { handler } from '../netlify/functions/pack-team-capability';
export default adapt(handler);
export const config = { maxDuration: 300 };
