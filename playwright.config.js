const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 60000, // 60 secondes par test
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    navigationTimeout: 45000, // 45 secondes pour la navigation
    actionTimeout: 15000, // 15 secondes pour les actions
    ignoreHTTPSErrors: true, // Ignorer les erreurs SSL
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use new headless mode with better WebGL support
        headless: true,
        // Add args to make headless mode work better with WebGL
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--enable-webgl',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--disable-gpu-sandbox',
          ],
        },
      },
    },
  ],
});
