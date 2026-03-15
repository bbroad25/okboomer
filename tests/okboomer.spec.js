import { test, expect } from '@playwright/test';
import path from 'path';

// ─── Layout & Header ────────────────────────────────────────────────────────

test.describe('Header and branding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays the OkBoomer logo', async ({ page }) => {
    const logo = page.locator('.ok-boomer-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText('Ok');
    await expect(logo).toContainText('Boomer');
  });

  test('shows tagline', async ({ page }) => {
    await expect(page.getByText("No, Grandpa, it's not a virus")).toBeVisible();
  });

  test('shows the three feature tags', async ({ page }) => {
    await expect(page.getByText('MEMES DECODED')).toBeVisible();
    await expect(page.getByText('SLANG TRANSLATED')).toBeVisible();
    await expect(page.getByText('VIBES EXPLAINED')).toBeVisible();
  });
});

// ─── Mode Tabs ───────────────────────────────────────────────────────────────

test.describe('Input mode tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows all three mode tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Type Slang/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Paste a Link/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload a Meme/i })).toBeVisible();
  });

  test('Type Slang tab is active by default', async ({ page }) => {
    const activeTab = page.getByRole('button', { name: /Type Slang/i });
    await expect(activeTab).toHaveCSS('background-color', 'rgb(26, 26, 46)');
  });

  test('clicking Paste a Link tab shows URL input', async ({ page }) => {
    await page.getByRole('button', { name: /Paste a Link/i }).click();
    await expect(page.getByPlaceholder(/https:\/\//i)).toBeVisible();
    await expect(page.getByText(/Paste a link your grandkid sent you/i)).toBeVisible();
  });

  test('clicking Upload a Meme tab shows file upload area', async ({ page }) => {
    await page.getByRole('button', { name: /Upload a Meme/i }).click();
    await expect(page.getByText(/Drag & drop your meme here/i)).toBeVisible();
  });

  test('switching tabs clears previous response', async ({ page }) => {
    // Type something first
    await page.getByRole('button', { name: /Type Slang/i }).click();
    await page.locator('textarea').fill('no cap');
    // Switch tab
    await page.getByRole('button', { name: /Paste a Link/i }).click();
    // Switch back
    await page.getByRole('button', { name: /Type Slang/i }).click();
    // Response area should not be visible
    await expect(page.getByText('Translation Complete')).not.toBeVisible();
  });
});

// ─── Text Input ──────────────────────────────────────────────────────────────

test.describe('Text slang input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('textarea is visible and accepts input', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('no cap fr fr');
    await expect(textarea).toHaveValue('no cap fr fr');
  });

  test('submit button is disabled when textarea is empty', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Explain This To Me/i });
    await expect(btn).toBeDisabled();
  });

  test('submit button enables when textarea has text', async ({ page }) => {
    await page.locator('textarea').fill('bussin');
    const btn = page.getByRole('button', { name: /Explain This To Me/i });
    await expect(btn).toBeEnabled();
  });

  test('submit button disables again when textarea is cleared', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('slay');
    await textarea.fill('');
    await expect(page.getByRole('button', { name: /Explain This To Me/i })).toBeDisabled();
  });

  test('shows example chips', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'no cap fr fr' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'touch grass' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'slay bestie' })).toBeVisible();
  });

  test('clicking an example chip fills the textarea', async ({ page }) => {
    await page.getByRole('button', { name: 'touch grass' }).click();
    await expect(page.locator('textarea')).toHaveValue('touch grass');
  });

  test('clicking example chip enables submit button', async ({ page }) => {
    await page.getByRole('button', { name: 'understood the assignment' }).click();
    await expect(page.getByRole('button', { name: /Explain This To Me/i })).toBeEnabled();
  });
});

// ─── URL Input ───────────────────────────────────────────────────────────────

test.describe('URL input mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Paste a Link/i }).click();
  });

  test('submit button disabled when URL input is empty', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Explain This To Me/i })).toBeDisabled();
  });

  test('submit button enables when URL is entered', async ({ page }) => {
    await page.getByPlaceholder(/https:\/\//i).fill('https://example.com');
    await expect(page.getByRole('button', { name: /Explain This To Me/i })).toBeEnabled();
  });

  test('shows helper note about link explanation', async ({ page }) => {
    await expect(page.getByText(/explain what the link appears to be about/i)).toBeVisible();
  });
});

// ─── Image Upload ─────────────────────────────────────────────────────────────

test.describe('Image upload mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Upload a Meme/i }).click();
  });

  test('shows drag and drop zone', async ({ page }) => {
    await expect(page.getByText(/Drag & drop your meme here/i)).toBeVisible();
  });

  test('submit button disabled before image upload', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Explain This To Me/i })).toBeDisabled();
  });

  test('shows supported formats hint', async ({ page }) => {
    await expect(page.getByText(/JPG, PNG, GIF, WEBP/i)).toBeVisible();
  });

  test('file input accepts image types only', async ({ page }) => {
    const input = page.locator('input[type="file"]');
    await expect(input).toHaveAttribute('accept', 'image/*');
  });

  test('uploading an image shows preview and enables submit', async ({ page }) => {
    // Create a minimal 1x1 PNG as a buffer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'test-meme.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    await expect(page.locator('img[alt="Uploaded meme"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Explain This To Me/i })).toBeEnabled();
  });

  test('remove button clears uploaded image', async ({ page }) => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });
    await expect(page.locator('img[alt="Uploaded meme"]')).toBeVisible();
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.locator('img[alt="Uploaded meme"]')).not.toBeVisible();
    await expect(page.getByText(/Drag & drop your meme here/i)).toBeVisible();
  });
});

// ─── API Integration (mocked) ────────────────────────────────────────────────

test.describe('API call and response rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Anthropic API
    await page.route('**/anthropic.com/v1/messages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: [{
            type: 'text',
            text: `📖 **What it means:**
No cap means "I'm not lying" or "for real." It's the Gen-Z version of "I swear on my mother's grave," but less dramatic.

🕰️ **The backstory:**
"Cap" is slang for a lie. So "no cap" = no lie. It showed up in hip-hop culture around 2010 and went fully mainstream around 2018. Your grandkids have been saying it for years while you nodded politely.

💬 **Use it in a sentence:**
"That casserole was the best thing I've ever eaten, no cap."

📊 **Boomer Rating:**
😴 Completely harmless. You can even use this one yourself — your grandkids will be horrified and delighted in equal measure.`
          }]
        }),
      });
    });
  });

  test('shows loading state while waiting for response', async ({ page }) => {
    await page.goto('/');
    // Slow down the mock so we can catch the loading state
    await page.route('**/anthropic.com/v1/messages', async (route) => {
      await page.waitForTimeout(500);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: [{ type: 'text', text: '📖 **What it means:** test 🕰️ **The backstory:** test 💬 **Use it in a sentence:** test 📊 **Boomer Rating:** 😴 test' }] }),
      });
    });
    await page.locator('textarea').fill('bussin');
    await page.getByRole('button', { name: /Explain This To Me/i }).click();
    await expect(page.getByText(/Consulting our intern/i)).toBeVisible();
  });

  test('renders all four response sections', async ({ page }) => {
    await page.goto('/');
    await page.locator('textarea').fill('no cap');
    await page.getByRole('button', { name: /Explain This To Me/i }).click();
    await expect(page.getByText('Translation Complete')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/What it means/i)).toBeVisible();
    await expect(page.getByText(/The backstory/i)).toBeVisible();
    await expect(page.getByText(/Use it in a sentence/i)).toBeVisible();
    await expect(page.getByText(/Boomer Rating/i)).toBeVisible();
  });

  test('shows BOOMER EDITION badge in response header', async ({ page }) => {
    await page.goto('/');
    await page.locator('textarea').fill('no cap');
    await page.getByRole('button', { name: /Explain This To Me/i }).click();
    await expect(page.getByText('BOOMER EDITION')).toBeVisible({ timeout: 10000 });
  });

  test('Try Another button resets the UI', async ({ page }) => {
    await page.goto('/');
    await page.locator('textarea').fill('no cap');
    await page.getByRole('button', { name: /Explain This To Me/i }).click();
    await expect(page.getByText('Translation Complete')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Try Another/i }).click();
    await expect(page.getByText('Translation Complete')).not.toBeVisible();
    await expect(page.locator('textarea')).toHaveValue('');
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────────

test.describe('Error handling', () => {
  test('shows error message when API fails', async ({ page }) => {
    await page.route('**/anthropic.com/v1/messages', async (route) => {
      await route.abort('failed');
    });
    await page.goto('/');
    await page.locator('textarea').fill('no cap');
    await page.getByRole('button', { name: /Explain This To Me/i }).click();
    await expect(page.getByText(/Something went sideways/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─── Mobile Responsiveness ───────────────────────────────────────────────────

test.describe('Mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders logo on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ok-boomer-logo')).toBeVisible();
  });

  test('all three tabs are visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Type Slang/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Paste a Link/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload a Meme/i })).toBeVisible();
  });

  test('submit button is full width on mobile', async ({ page }) => {
    await page.goto('/');
    await page.locator('textarea').fill('bussin');
    const btn = page.getByRole('button', { name: /Explain This To Me/i });
    const box = await btn.boundingBox();
    expect(box.width).toBeGreaterThan(300);
  });
});
