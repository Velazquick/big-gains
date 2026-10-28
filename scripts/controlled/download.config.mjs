import original from '../../playwright.config.js';
import {devices} from '@playwright/test';
export default {...original,testDir:'../../tests/controlled',testMatch:'download-original.spec.js',workers:1,retries:0,timeout:30000,fullyParallel:false,projects:[{name:'webkit',use:{...devices['iPhone 13']}}],reporter:[['line'],['json',{outputFile:process.env.DIAG_OUTPUT+'/report.json'}]],use:{...original.use,trace:'retain-on-failure',video:'retain-on-failure'},outputDir:process.env.DIAG_OUTPUT+'/test-results',webServer:{...original.webServer,reuseExistingServer:false}};
