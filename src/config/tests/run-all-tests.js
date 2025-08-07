const { spawn } = require('child_process');
const path = require('path');

class TestRunner {
  constructor() {
    this.testSuites = [
      { name: 'MySQL', file: 'mysql-test-suite.js' },
      { name: 'PostgreSQL', file: 'postgres-test-suite.js' },
      { name: 'Oracle', file: 'oracle-test-suite.js' },
      { name: 'MSSQL', file: 'mssql-test-suite.js' }
    ];
    this.results = {};
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m', 
      error: '\x1b[31m',
      warning: '\x1b[33m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${message}${reset}`);
  }

  async runTest(testSuite) {
    return new Promise((resolve) => {
      this.log(`\n🚀 Running ${testSuite.name} Tests...`, 'info');
      
      const testProcess = spawn('node', [path.join(__dirname, testSuite.file)]);

      let output = '';
      testProcess.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(text);
        output += text;
      });

      testProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      testProcess.on('close', (code) => {
        const success = code === 0;
        
        // Extract results
        const successRateMatch = output.match(/Success Rate: ([\d.]+)%/);
        const passedMatch = output.match(/Passed: (\d+)/);
        const failedMatch = output.match(/Failed: (\d+)/);
        
        this.results[testSuite.name] = {
          success,
          successRate: successRateMatch ? parseFloat(successRateMatch[1]) : 0,
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0
        };

        resolve();
      });
    });
  }

  async runAll() {
    console.log('\n🧪 Database Strategy Test Suite');
    console.log('=' * 40);
    
    for (const testSuite of this.testSuites) {
      await this.runTest(testSuite);
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 SUMMARY');
    console.log('=' * 30);
    
    let totalPassed = 0;
    let totalFailed = 0;

    Object.entries(this.results).forEach(([name, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${name}: ${result.successRate}% (${result.passed}/${result.passed + result.failed})`);
      
      totalPassed += result.passed;
      totalFailed += result.failed;
    });

    const overall = totalPassed + totalFailed > 0 ? 
      ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : 0;
    
    console.log(`\nOVERALL: ${overall}% (${totalPassed}/${totalPassed + totalFailed})`);
  }
}

if (require.main === module) {
  const runner = new TestRunner();
  runner.runAll().catch(console.error);
}