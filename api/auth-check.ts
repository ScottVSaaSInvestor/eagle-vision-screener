import { adapt } from './_adapter';
import { handler } from '../netlify/functions/auth-check';
export default adapt(handler);
export const config = { maxDuration: 300 };
