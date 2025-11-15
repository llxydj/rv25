#!/usr/bin/env node
/**
 * RVOIS System Test Executor
 * Automated testing script for core RVOIS functionalities
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  serverPort: 3000,
  testUsers: {
    admin: { email: 'admin@test.com', password: 'TestPass123!' },
    resident: { email: 'resident@test.com', password: 'TestPass123!' },
    volunteer: { email: 'volunteer@test.com', password: 'TestPass123!' }
  }
};

// Test results tracker
const testResults: { name: string; status: 'pass' | 'fail' | 'skip'; duration: number; error?: string }[] = [];

// Utility functions
const log = (message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warn: '\x1b[33m',    // Yellow
    reset: '\x1b[0m'     // Reset
  };
  
  console.log(`${colors[type]}[${new Date().toISOString()}] ${message}${colors.reset}`);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test executor
class SystemTestExecutor {
  private serverProcess: any = null;
  
  async startServer() {
    log('Starting Next.js development server...', 'info');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('pnpm', ['dev'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      let serverStarted = false;
      
      this.serverProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        process.stdout.write(output);
        
        if (output.includes('ready started server') || output.includes('Local:')) {
          if (!serverStarted) {
            serverStarted = true;
            log('Server started successfully!', 'success');
            resolve(true);
          }
        }
      });
      
      this.serverProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString());
      });
      
      this.serverProcess.on('error', (error: Error) => {
        log(`Server error: ${error.message}`, 'error');
        reject(error);
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        if (!serverStarted) {
          log('Server failed to start within timeout period', 'error');
          reject(new Error('Server timeout'));
        }
      }, 60000);
    });
  }
  
  async stopServer() {
    if (this.serverProcess) {
      log('Stopping server...', 'info');
      this.serverProcess.kill();
      await sleep(2000);
      log('Server stopped', 'success');
    }
  }
  
  async runUnitTestSuite() {
    log('Running unit tests...', 'info');
    
    return new Promise((resolve) => {
      const testProcess = spawn('pnpm', ['test'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          log('Unit tests completed successfully!', 'success');
          testResults.push({
            name: 'Unit Tests',
            status: 'pass',
            duration: 0
          });
        } else {
          log('Unit tests failed!', 'error');
          testResults.push({
            name: 'Unit Tests',
            status: 'fail',
            duration: 0,
            error: 'Unit tests failed with exit code ' + code
          });
        }
        resolve(code === 0);
      });
    });
  }
  
  async runTypeCheck() {
    log('Running TypeScript type checking...', 'info');
    
    return new Promise((resolve) => {
      const typeCheckProcess = spawn('pnpm', ['check:types'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      
      typeCheckProcess.on('close', (code) => {
        if (code === 0) {
          log('Type checking completed successfully!', 'success');
          testResults.push({
            name: 'Type Checking',
            status: 'pass',
            duration: 0
          });
        } else {
          log('Type checking failed!', 'error');
          testResults.push({
            name: 'Type Checking',
            status: 'fail',
            duration: 0,
            error: 'Type checking failed with exit code ' + code
          });
        }
        resolve(code === 0);
      });
    });
  }
  
  async runLinting() {
    log('Running code linting...', 'info');
    
    return new Promise((resolve) => {
      const lintProcess = spawn('pnpm', ['lint'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      
      lintProcess.on('close', (code) => {
        if (code === 0) {
          log('Code linting completed successfully!', 'success');
          testResults.push({
            name: 'Code Linting',
            status: 'pass',
            duration: 0
          });
        } else {
          log('Code linting failed!', 'error');
          testResults.push({
            name: 'Code Linting',
            status: 'fail',
            duration: 0,
            error: 'Code linting failed with exit code ' + code
          });
        }
        resolve(code === 0);
      });
    });
  }
  
  async checkBuild() {
    log('Checking build...', 'info');
    
    return new Promise((resolve) => {
      const buildProcess = spawn('pnpm', ['build'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      
      buildProcess.on('close', (code) => {
        if (code === 0) {
          log('Build completed successfully!', 'success');
          testResults.push({
            name: 'Build Check',
            status: 'pass',
            duration: 0
          });
        } else {
          log('Build failed!', 'error');
          testResults.push({
            name: 'Build Check',
            status: 'fail',
            duration: 0,
            error: 'Build failed with exit code ' + code
          });
        }
        resolve(code === 0);
      });
    });
  }
  
  generateTestReport() {
    log('Generating test report...', 'info');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testResults.length,
        passed: testResults.filter(t => t.status === 'pass').length,
        failed: testResults.filter(t => t.status === 'fail').length,
        skipped: testResults.filter(t => t.status === 'skip').length
      },
      details: testResults
    };
    
    const reportPath = join(process.cwd(), 'TEST_REPORT.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Test report saved to ${reportPath}`, 'success');
    
    // Also generate a human-readable version
    const readableReport = `
RVOIS System Test Report
========================
Generated: ${report.timestamp}

Summary:
- Total Tests: ${report.summary.total}
- Passed: ${report.summary.passed}
- Failed: ${report.summary.failed}
- Skipped: ${report.summary.skipped}

Detailed Results:
${testResults.map(test => 
  `- ${test.name}: ${test.status.toUpperCase()}${test.error ? ` (${test.error})` : ''}`
).join('\n')}
    `.trim();
    
    const readablePath = join(process.cwd(), 'TEST_REPORT.txt');
    writeFileSync(readablePath, readableReport);
    log(`Human-readable report saved to ${readablePath}`, 'success');
  }
  
  async runAllTests() {
    log('Starting RVOIS System Test Suite', 'info');
    const startTime = Date.now();
    
    try {
      // Start server
      await this.startServer();
      await sleep(5000); // Wait for server to fully initialize
      
      // Run automated tests
      await this.runUnitTestSuite();
      await this.runTypeCheck();
      await this.runLinting();
      await this.checkBuild();
      
      // Generate report
      this.generateTestReport();
      
      const totalTime = Date.now() - startTime;
      log(`All tests completed in ${totalTime}ms`, 'success');
      
      // Check if all tests passed
      const failedTests = testResults.filter(t => t.status === 'fail');
      if (failedTests.length === 0) {
        log('All tests passed! System is ready for deployment.', 'success');
        process.exit(0);
      } else {
        log(`${failedTests.length} test(s) failed. Please review the test report.`, 'error');
        process.exit(1);
      }
    } catch (error) {
      log(`Test execution failed: ${(error as Error).message}`, 'error');
      process.exit(1);
    } finally {
      await this.stopServer();
    }
  }
}

// Run the test suite
const executor = new SystemTestExecutor();
executor.runAllTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});