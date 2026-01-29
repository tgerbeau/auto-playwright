const { test, expect } = require('@playwright/test');

// Gestion commune de la popup "Bienvenue sur cartes.gouv.fr"
async function handleWelcomePopup(page) {
  try {
    // Attendre un peu pour que la page se charge
    await page.waitForTimeout(1000);
    
    // Chercher le bouton "Accéder aux cartes"
    const accessButton = page.getByRole('button', { name: /Accéder aux cartes/i });
    
    // Vérifier si le bouton est visible avec un timeout court
    const isVisible = await accessButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      await accessButton.click();
      // Attendre que la navigation soit complète
      await page.waitForURL(/explorer-les-cartes/, { timeout: 10000 });
      await page.waitForTimeout(2000);
    }
  } catch (error) {
    console.log('Popup "Bienvenue" non détectée ou déjà fermée');
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

// Tests Playwright standard
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
    const searchInput = page.locator('input.GPsearchInputText[aria-label="Rechercher"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('cadastre');
      await page.waitForTimeout(2000);
    }
  });

  test('Rechercher "Cadastre" et ouvrir "Cadastre, 97200 Fort-de-France"', async ({ page }) => {
    // Listen for console messages and errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // Mock the geocoding API to provide expected results
    await page.route('**/geocodage/completion**', async (route) => {
      const url = route.request().url();
      const searchText = new URL(url).searchParams.get('text');
      
      // Mock response with Cadastre results including Fort-de-France
      const mockResponse = {
        status: 'OK',
        results: [
          {
            fulltext: 'Cadastre, 97200 Fort-de-France',
            x: -61.0594,
            y: 14.6037,
            city: 'Fort-de-France',
            zipcode: '97200',
            street: 'Cadastre',
            kind: 'PositionOfInterest',
            importance: 0.9
          },
          {
            fulltext: 'Cadastre, 75001 Paris',
            x: 2.3522,
            y: 48.8566,
            city: 'Paris',
            zipcode: '75001',
            street: 'Cadastre',
            kind: 'PositionOfInterest',
            importance: 0.8
          }
        ]
      };
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
    
    // Aller directement sur la page explorer avec domcontentloaded pour ne pas bloquer sur les popups
    await page.goto('https://cartes.gouv.fr/explorer-les-cartes/', { waitUntil: 'domcontentloaded' });

    console.log('Page loaded, checking for popups...');
    
    // Check if WebGL is available
    const hasWebGL = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    });
    console.log('WebGL available:', hasWebGL);
    
    // Check for any app root elements
    const appRoots = await page.evaluate(() => {
      return {
        root: !!document.getElementById('root'),
        app: !!document.getElementById('app'),
        hasCanvas: document.getElementsByTagName('canvas').length,
        bodyChildren: document.body.children.length
      };
    });
    console.log('App structure:', appRoots);

    // Gérer la popup "Bienvenue" si elle s'affiche (elle bloque le chargement complet)
    await page.waitForTimeout(1000);
    await handleWelcomePopup(page);
    console.log('Welcome popup handled');
    
    // Puis accepter les cookies si la bannière est présente
    await handleCookieBanner(page);
    console.log('Cookie banner handled');

    // Maintenant attendre que le contenu de la carte se charge
    await page.waitForTimeout(5000);

    // Debug: afficher le contenu HTML pour voir ce qui est chargé
    const bodyContent = await page.locator('body').innerHTML();
    console.log('Body HTML length:', bodyContent.length);
    
    // Vérifier si un élément avec ID contenant "root" ou "app" existe (typique des SPAs)
    const appRoot = page.locator('#root, #app, [id*="app"], main, [role="main"]').first();
    const hasAppRoot = await appRoot.isVisible().catch(() => false);
    console.log('App root visible:', hasAppRoot);

    // Vérifier si le bouton de navigation est présent (indique que la page est chargée)
    const navButton = page.locator('button.fr-btn.fr-btn--secondary.fr-btn--md.navBarIcon.navButton').first();
    if (await navButton.isVisible().catch(() => false)) {
      console.log('Navigation button found, page seems loaded');
      // Cliquer sur le bouton pour ouvrir la recherche si nécessaire
      await navButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('Navigation button NOT found');
    }

    // Sélecteur basé sur la classe et l'aria-label du champ de recherche
    const searchInput = page.locator('input.GPsearchInputText[aria-label="Rechercher"]').first();
    
    // Attendre que le champ soit visible
    await expect(searchInput).toBeVisible({ timeout: 40000 });
    
    // Fermer le menu qui pourrait bloquer l'accès au champ de recherche
    const closeButton = page.getByRole('button', { name: /Fermer/i });
    if (await closeButton.isVisible().catch(() => false)) {
      console.log('Closing menu...');
      await closeButton.click();
      await page.waitForTimeout(500);
    }
    
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

  test('Rechercher "Toulouse"', async ({ page }) => {
    // Listen for console messages and errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // Aller directement sur la page explorer
    await page.goto('https://cartes.gouv.fr/explorer-les-cartes/', { waitUntil: 'domcontentloaded' });

    console.log('Page loaded, checking for popups...');
    
    // Gérer la popup "Bienvenue" si elle s'affiche
    await page.waitForTimeout(1000);
    await handleWelcomePopup(page);
    console.log('Welcome popup handled');
    
    // Puis accepter les cookies si la bannière est présente
    await handleCookieBanner(page);
    console.log('Cookie banner handled');

    // Attendre que le contenu de la carte se charge
    await page.waitForTimeout(5000);

    // Vérifier si le bouton de navigation est présent
    const navButton = page.locator('button.fr-btn.fr-btn--secondary.fr-btn--md.navBarIcon.navButton').first();
    if (await navButton.isVisible().catch(() => false)) {
      console.log('Navigation button found, page seems loaded');
      await navButton.click();
      await page.waitForTimeout(1000);
    }

    // Sélecteur basé sur la classe et l'aria-label du champ de recherche
    const searchInput = page.locator('input.GPsearchInputText[aria-label="Rechercher"]').first();
    
    // Attendre que le champ soit visible
    await expect(searchInput).toBeVisible({ timeout: 40000 });
    
    // Fermer le menu qui pourrait bloquer l'accès au champ de recherche
    const closeButton = page.getByRole('button', { name: /Fermer/i });
    if (await closeButton.isVisible().catch(() => false)) {
      console.log('Closing menu...');
      await closeButton.click();
      await page.waitForTimeout(500);
    }
    
    // Cliquer et remplir le champ de recherche
    await searchInput.click();
    await searchInput.type('Toulouse, 31000', { delay: 100 });
    await page.waitForTimeout(2000);

    // Attendre que les résultats apparaissent
    const toulouseResult = page.getByText(/Toulouse/i).first();
    await expect(toulouseResult).toBeVisible({ timeout: 30000 });
    await toulouseResult.click();

    // Vérifier qu'une carte est bien chargée
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
