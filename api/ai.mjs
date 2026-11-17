import { handleAI } from '../server/ai-handler.mjs';

export function GET(request) { return handleAI(request); }
export function POST(request) { return handleAI(request); }
export function OPTIONS(request) { return handleAI(request); }
