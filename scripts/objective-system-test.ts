#!/usr/bin/env node
/**
 * Objective RVOIS System Test
 * Creates a result file with unbiased test results
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Test result interface
interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  timestamp: string;
  details?: string;
}

// Test results array
const results: TestResult[] = [];

// Utility functions
const logResult = (testName: string, status: 'PASS' | 'FAIL' | 'SKIP', details?: string) => {
  const result: TestResult = {
    testName,
    status,
    timestamp: new Date().toISOString(),
    details
  };
  
  results.push(result);
  console.log(`${status}: ${testName}${details ? ` - ${details}` : ''}`);
};

// File paths to check
const filePaths = [
  'src/app/admin/dashboard/page.tsx',
  'src/app/resident/report/page.tsx',
  'src/app/volunteer/dashboard/page.tsx',
  'src/lib/incidents.ts',
  'src/lib/supabase.ts',
  'src/components/ui/map-component.tsx',
  'package.json',
  'tsconfig.json'
];

// Test functions
const testFileExistence = () => {
  console.log('Testing file existence...');
  
  for (const filePath of filePaths) {
    const fullPath = join(process.cwd(), filePath);
    if (existsSync(fullPath)) {
      logResult(`File exists: ${filePath}`, 'PASS');
    } else {
      logResult(`File exists: ${filePath}`, 'FAIL', 'File not found');
    }
  }
};

const testEnvironmentConfig = () => {
  console.log('Testing environment configuration...');
  
  // Check if required environment variables are defined
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      logResult(`Environment variable: ${envVar}`, 'PASS');
    } else {
      logResult(`Environment variable: ${envVar}`, 'FAIL', 'Not defined');
    }
  }
};

const testPackageJson = () => {
  console.log('Testing package.json configuration...');
  
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    if (!existsSync(packageJsonPath)) {
      logResult('package.json exists', 'FAIL', 'File not found');
      return;
    }
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    // Check for required scripts
    const requiredScripts = ['dev', 'build', 'start', 'test'];
    for (const script of requiredScripts) {
      if (packageJson.scripts && packageJson.scripts[script]) {
        logResult(`Script exists: ${script}`, 'PASS');
      } else {
        logResult(`Script exists: ${script}`, 'FAIL', 'Script not defined');
      }
    }
    
    // Check for required dependencies
    const requiredDeps = [
      'next',
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'tailwindcss'
    ];
    
    for (const dep of requiredDeps) {
      if ((packageJson.dependencies && packageJson.dependencies[dep]) || 
          (packageJson.devDependencies && packageJson.devDependencies[dep])) {
        logResult(`Dependency exists: ${dep}`, 'PASS');
      } else {
        logResult(`Dependency exists: ${dep}`, 'FAIL', 'Dependency not found');
      }
    }
    
  } catch (error) {
    logResult('package.json validation', 'FAIL', (error as Error).message);
  }
};

const testBuildProcess = () => {
  console.log('Testing build process...');
  
  // This is a placeholder - in a real test, you would actually run the build
  logResult('Build process test', 'SKIP', 'Build test requires execution environment');
};

const testSupabaseConnection = () => {
  console.log('Testing Supabase connection...');
  
  // This is a placeholder - in a real test, you would actually test the connection
  logResult('Supabase connection test', 'SKIP', 'Connection test requires credentials');
};

const generateTestReport = () => {
  console.log('Generating test report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    results
  };
  
  // Write JSON report
  const jsonReportPath = join(process.cwd(), 'OBJECTIVE_TEST_RESULTS.json');
  writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
  console.log(`JSON report saved to: ${jsonReportPath}`);
  
  // Write human-readable report
  let humanReport = `RVOIS Objective System Test Report\n`;
  humanReport += `==================================\n`;
  humanReport += `Generated: ${report.timestamp}\n`;
  humanReport += `System: ${report.systemInfo.platform} ${report.systemInfo.architecture} Node.js ${report.systemInfo.nodeVersion}\n\n`;
  
  humanReport += `Test Results:\n`;
  humanReport += `-------------\n`;
  
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  for (const result of results) {
    humanReport += `${result.status.padEnd(4)}: ${result.testName}\n`;
    if (result.details) {
      humanReport += `      ${result.details}\n`;
    }
    
    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else if (result.status === 'SKIP') skipCount++;
  }
  
  humanReport += `\nSummary:\n`;
  humanReport += `--------\n`;
  humanReport += `PASS: ${passCount}\n`;
  humanReport += `FAIL: ${failCount}\n`;
  humanReport += `SKIP: ${skipCount}\n`;
  humanReport += `TOTAL: ${results.length}\n`;
  
  const humanReportPath = join(process.cwd(), 'OBJECTIVE_TEST_RESULTS.txt');
  writeFileSync(humanReportPath, humanReport);
  console.log(`Human-readable report saved to: ${humanReportPath}`);
};

// Main test execution
const runTests = () => {
  console.log('Starting Objective RVOIS System Test...\n');
  
  try {
    testFileExistence();
    testEnvironmentConfig();
    testPackageJson();
    testBuildProcess();
    testSupabaseConnection();
    
    generateTestReport();
    
    console.log('\nObjective testing completed. Results saved to OBJECTIVE_TEST_RESULTS.json and OBJECTIVE_TEST_RESULTS.txt');
  } catch (error) {
    console.error('Test execution failed:', (error as Error).message);
    process.exit(1);
  }
};

// Run tests
runTests();