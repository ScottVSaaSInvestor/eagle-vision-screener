import { adapt } from './_adapter';
import { handler } from '../netlify/functions/document-parse';
export default adapt(handler);
export const config = { maxDuration: 300 };
