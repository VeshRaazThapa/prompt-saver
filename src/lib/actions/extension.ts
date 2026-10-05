'use server';

import { getCurrentContext } from '../auth/context';
import { ValidationError } from '../errors';
import { EXTENSION_TOKEN_NAME, isAllowedExtensionId } from '../extension/ids';
import { createToken, listTokens, revokeToken } from '../tokens/repository';
import { run, type ActionResult } from './result';

/**
 * Mints the extension's API token. Called only from the Connect button click,
 * never on page load, so visiting the page alone can't create tokens.
 * At most one active extension token per user: earlier ones are revoked.
 */
export async function connectExtensionAction(
  extId: string
): Promise<ActionResult<{ token: string; tokenId: string }>> {
  return run(async () => {
    if (!isAllowedExtensionId(extId)) {
      throw new ValidationError(
        'Unknown extension. Reinstall Prompt Saver from the Chrome Web Store.'
      );
    }
    const { userId } = await getCurrentContext();
    const existing = await listTokens(userId);
    for (const t of existing) {
      if (t.name === EXTENSION_TOKEN_NAME && t.revokedAt === null) {
        await revokeToken(t.id, userId);
      }
    }
    const { token, id } = await createToken(userId, EXTENSION_TOKEN_NAME);
    return { token, tokenId: id };
  });
}
