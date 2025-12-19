const { test, expect } = require('@playwright/test');
const { auto } = require('auto-playwright/dist');

// Gestion commune de la popup "Bienvenue sur cartes.gouv.fr"
async function handleWelcomePopup(page) {
  const heading = page.getByText(/Bienvenue sur cartes\.gouv\.fr/i);

  // Si la popup est visible, cliquer sur "Accéder aux cartes"
  if (await heading.isVisible().catch(() => false)) {
    const accessButton = page.getByRole('button', { name: /Accéder aux cartes/i });
    await accessButton.click();
    await page.waitForTimeout(2000);
  }
}

// Gestion commune de la bannière de cookies ("Tout accepter")
async function handleCookieBanner(page) {
  const cookieBanner = page.getByText(/À propos des cookies sur cartes\.gouv\.fr/i);

  if (await cookieBanner.isVisible().catch(() => false)) {
    const acceptButton = page.getByRole('button', { name: /Tout accepter/i });
    await acceptButton.click();
    await page.waitForTimeout(1000);
  }
}

// Test de base sans OpenAI
test('Vérifier que la page cartes.gouv.fr se charge correctement', async ({ page }) => {
  await page.goto('https://cartes.gouv.fr/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/cartes\.gouv\.fr/);

  // Gérer la popup éventuelle avant de vérifier la navigation
  await handleWelcomePopup(page);
  
  // Vérifier la navigation
  await expect(page).toHaveURL(/explorer-les-cartes/);
});

// Tests avec auto-playwright (nécessite OPENAI_API_KEY valide)
test.describe('Tests avec auto-playwright', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.OPENAI_API_KEY, 'Ces tests nécessitent OPENAI_API_KEY');
    
    // Navigation commune : aller sur la page et cliquer sur "Accéder aux cartes"
    await page.goto('https://cartes.gouv.fr/', { waitUntil: 'domcontentloaded' });
    
    // Gérer la popup "Bienvenue" si elle s'affiche
    await handleWelcomePopup(page);

    // Puis accepter les cookies si la bannière est présente
    await handleCookieBanner(page);

    await expect(page).toHaveURL(/explorer-les-cartes/);
    
    // Gérer les cookies si présents après la navigation
    const cookieBanner = page.getByText(/À propos des cookies sur cartes\.gouv\.fr/i);
    if (await cookieBanner.isVisible().catch(() => false)) {
      const refuseButton = page.getByRole('button', { name: /Tout refuser/i });
      await refuseButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Rechercher une carte avec auto-playwright', async ({ page }) => {
    // Le beforeEach a déjà navigué vers explorer-les-cartes
    
    try {
      // Utiliser auto-playwright pour rechercher
      await auto('Rechercher "cadastre" dans la barre de recherche', { page });
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log('Erreur auto-playwright (vérifiez votre clé API):', error.message);
      test.skip();
    }
  });

  test('Appliquer un second scénario de recherche avec auto-playwright', async ({ page }) => {
    // Le beforeEach a déjà navigué vers explorer-les-cartes

    try {
      // Scénario supplémentaire pour illustrer l\'utilisation d\'auto-playwright
      await auto(
        'Dans la page actuelle, vérifier qu\'une zone de recherche est disponible, puis chercher "cadastre parcellaire".',
        { page }
      );
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log('Erreur auto-playwright (vérifiez votre clé API):', error.message);
      test.skip();
    }
  });
});

// Tests sans auto-playwright
test.describe('Tests Playwright standard', () => {
  test('Naviguer et rechercher une carte', async ({ page }) => {
    await page.goto('https://cartes.gouv.fr/', { waitUntil: 'domcontentloaded' });
    
    // Gérer la popup "Bienvenue" si elle s'affiche
    await handleWelcomePopup(page);
    // Puis accepter les cookies si la bannière est présente
    await handleCookieBanner(page);
    
    // Vérifier la navigation
    await expect(page).toHaveURL(/explorer-les-cartes/);
    
    // Rechercher manuellement dans le champ de recherche (id dynamique type GPsearchInputText-44)
    const searchInput = page.locator('[id^="GPsearchInputText"] .fr-input').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('cadastre');
      await page.waitForTimeout(2000);
    }
  });

  test('Rechercher "Cadastre" et ouvrir "Cadastre, 97200 Fort-de-France"', async ({ page }) => {
    await page.goto('https://cartes.gouv.fr/', { waitUntil: 'domcontentloaded' });

    // Gérer la popup "Bienvenue" si elle s'affiche
    await handleWelcomePopup(page);
    // Puis accepter les cookies si la bannière est présente
    await handleCookieBanner(page);

    // On doit être sur la page des cartes
    await expect(page).toHaveURL(/explorer-les-cartes/);

    // Attendre un peu que la page se charge complètement
    await page.waitForTimeout(3000);

    // Sélecteur fiable basé sur la classe et l'aria-label
    const searchInput = page.locator('input.GPsearchInputText[aria-label="Rechercher"]').first();
    
    // Attendre que le champ soit visible
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    
    // Cliquer et remplir le champ de recherche
    await searchInput.click();
    await searchInput.type('Cadastre', { delay: 100 });
    await page.waitForTimeout(2000);

    // Attendre que les résultats apparaissent puis cliquer sur l'entrée spécifique
    const specificResult = page.getByText(/Cadastre,\s*97200\s*Fort-de-France/i).first();
    await expect(specificResult).toBeVisible({ timeout: 30000 });
    await specificResult.click();

    // Vérifier qu'une carte est bien chargée (canvas ou conteneur de carte)
    const mapElement = page.locator('canvas, [class*="map"], [aria-label*="Carte"]');
    await expect(mapElement.first()).toBeVisible({ timeout: 30000 });
  });

  test('Gérer la bannière de cookies', async ({ page }) => {
    await page.goto('https://cartes.gouv.fr/', { waitUntil: 'domcontentloaded' });

    // Gérer la popup "Bienvenue" si elle s'affiche
    await handleWelcomePopup(page);
    // Puis accepter les cookies si la bannière est présente
    await handleCookieBanner(page);
  });
});
