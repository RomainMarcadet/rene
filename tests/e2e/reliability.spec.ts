import { test, expect, type Page } from '@playwright/test';
import { type RoomSnapshot } from '@rene/contracts';
import { joinFour, submitDescription } from './helpers';

async function state(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/store.ts'; const { useGame } = await import(path);
    const { room, secret, session } = useGame.getState();
    return { room: room as RoomSnapshot, id: session.playerId as string, inGame: Boolean(secret?.inGame), white: secret?.inGame && secret.word === null };
  });
}

test('an arriving player sees existing clues on mobile, reconnects and joins the next game', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const { contexts, pages, names } = await joinFour(browser, baseURL!);
  const guestContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await guestContext.newPage();
  try {
    const host = pages[0];
    await host.getByRole('button', { name: 'Choisir les thèmes', exact: true }).click();
    await host.getByLabel('Répartition automatique des rôles').uncheck();
    await host.getByLabel('Undercovers', { exact: true }).fill('0');
    await host.getByLabel('Mr. Whites', { exact: true }).fill('1');
    await host.getByRole('button', { name: 'Enregistrer les règles', exact: true }).click();
    await Promise.all(pages.map(page => page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click()));
    await host.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect(host.locator('.phase-description')).toBeVisible({ timeout: 15000 });
    const playerStates = await Promise.all(pages.map(state));
    const byId = new Map(playerStates.map((value, index) => [value.id, pages[index]]));
    const white = playerStates.findIndex(value => value.white);
    expect(white).toBeGreaterThanOrEqual(0);
    for (let index = 0; index < 4; index++) {
      const room = (await state(host)).room;
      await submitDescription(byId.get(room.game!.turnPlayerId!)!, `Piste publique ${index + 1}`, pages);
      if (index === 1) {
        await guest.goto(`/?room=${room.code}`);
        await guest.getByLabel('Pseudonyme').fill('Nouvelle amie');
        await guest.getByRole('button', { name: /Rejoindre →/ }).click();
        await expect(guest.locator('.waiting-notice')).toContainText('Vous jouez à la prochaine partie.');
        await expect(guest.locator('.clues-zone')).toBeVisible();
        await expect(guest.locator('.current-round')).toContainText('Piste publique 1');
        await expect(guest.locator('.current-round')).toContainText('Piste publique 2');
        await expect(guest.getByLabel('Votre indice', { exact: true })).toHaveCount(0);
        expect((await state(guest)).inGame).toBe(false);
        await guest.reload();
        await expect(guest.locator('.current-round')).toContainText('Piste publique 2');
        await expect(guest.locator('.participants li')).toHaveCount(5);
        await expect(guest.locator('.hub-canvas canvas')).toBeVisible();
        await expect(guest.getByRole('button', { name: 'Voir les indices déjà donnés ↗', exact: true })).toBeInViewport({ ratio: 1 });
        await guest.screenshot({ path: 'output/playwright/reliability-arrival-mobile.png' });
      }
    }
    await expect(guest.locator('.current-round')).toContainText('Piste publique 4');
    await expect(guest.locator('.current-round .player-token')).toHaveCount(0);
    await host.getByRole('button', { name: /Passer au vote/ }).click();
    for (const [index, page] of pages.entries()) {
      await page.getByRole('button', { name: `Voter pour ${names[index === white ? (white + 1) % 4 : white]}`, exact: true }).click();
    }
    await expect(pages[white].getByLabel('Le mot des Civils', { exact: true })).toBeVisible({ timeout: 15000 });
    await pages[white].getByLabel('Le mot des Civils', { exact: true }).fill('réponse fictive sans correspondance');
    await pages[white].getByRole('button', { name: 'Valider mon mot →', exact: true }).click();
    await expect(host.locator('.phase-results')).toBeVisible({ timeout: 15000 });
    await host.getByRole('button', { name: /Retour au salon/ }).click();
    await expect(guest.getByRole('button', { name: 'Je suis prêt →', exact: true })).toBeVisible();
    const guestState = await state(guest);
    expect(guestState.room.players.find(player => player.id === guestState.id)?.waiting).toBe(false);
    await Promise.all([...pages, guest].map(page => page.getByRole('button', { name: 'Je suis prêt →', exact: true }).click()));
    await host.getByRole('button', { name: /Lancer la partie/ }).click();
    await expect.poll(async () => (await state(guest)).inGame).toBe(true);
    await expect(guest.locator('.waiting-notice')).toHaveCount(0);
    await expect(guest.locator('.secret-card')).toBeInViewport({ ratio: 1 });
    await guest.reload();
    await expect(guest.locator('.secret-card')).toBeInViewport({ ratio: 1 });
    expect((await state(guest)).room.game!.order).toHaveLength(5);
  } finally {
    await Promise.all([...contexts, guestContext].map(context => context.close()));
  }
});
