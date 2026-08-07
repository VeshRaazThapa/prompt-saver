'use server';

import { getCurrentContext } from '../auth/context';
import { ValidationError } from '../errors';
import { createToken, listTokens, revokeToken, type TokenSummary } from '../tokens/repository';
import { run, type ActionResult } from './result';

export async function listTokensAction(): Promise<ActionResult<TokenSummary[]>> {
  return run(async () => {
    const { userId } = await getCurrentContext();
    return listTokens(userId);
  });
}

export async function createTokenAction(name: string): Promise<ActionResult<{ token: string }>> {
  return run(async () => {
    const { userId } = await getCurrentContext();
    const trimmed = name.trim();
    if (trimmed === '') {
      throw new ValidationError('Give the token a name so you can recognise it later.');
    }
    const { token } = await createToken(userId, trimmed);
    return { token };
  });
}

export async function revokeTokenAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { userId } = await getCurrentContext();
    const revoked = await revokeToken(id, userId);
    if (!revoked) {
      throw new ValidationError('Token not found.');
    }
    return null;
  });
}
