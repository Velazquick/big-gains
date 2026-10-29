import original from './playwright.config.js';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...original,
  testMatch:'body-map-pointer-prefix.diagnostic.spec.js',
  workers:1,retries:0,
  reporter:[['line'],['json',{outputFile:process.env.POINTER_RESULT_FILE}]],
  outputDir:process.env.POINTER_TEST_OUTPUT,
  use:{...original.use,trace:'on'}
});
