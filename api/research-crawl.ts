import { adapt } from './_adapter';
import { handler } from '../netlify/functions/research-crawl';
export default adapt(handler);
export const config = { maxDuration: 300 };
