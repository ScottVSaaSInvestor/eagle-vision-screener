import { adapt } from './_adapter';
import { handler } from '../netlify/functions/diagnose';
export default adapt(handler);
export const config = { maxDuration: 300 };
