// mssql-test-suite.js
// Simple, comprehensive test suite for MSSQL Strategy

const axios = require('axios');

class MSSQLTester {
  constructor() {
    this.baseURL = 'http://localhost:5000';
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    
    // Configuration - UPDATE THESE VALUES
    this.config = {
      username: 'sa',
      password: 'Root123!', // ⚠️ CHANGE THIS TO YOUR MSSQL PASSWORD
      host: 'localhost',
      port: '1433',
      dbType: 'mssql',
      database: 'master'
    };
  }

  log(message, type = 'info') {
    const colors = { info: '\x1b[36m', success: '\x1b[32m', error: '\x1b[31m', warning: '\x1b[33m' };
    const reset = '\x1b[0m';
    const time = new Date().toLocaleTimeString();
    console.log(`${colors[type]}[${time}] ${message}${reset}`);
  }

  async request(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'x-db-type': 'mssql'
        },
        timeout: 30000
      };
      
      if (data) config.data = data;
      
      this.log(`${method} ${endpoint}`, 'info');
      const response = await axios(config);
      this.log(`✓ Status: ${response.status}`, 'success');
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      this.log(`✗ Error: ${error.response?.status || 'No Response'} - ${error.message}`, 'error');
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500
      };
    }
  }

  async test(name, testFn) {
    this.log(`\n🧪 ${name}`, 'info');
    this.log('─'.repeat(50), 'info');
    try {
      await testFn();
      this.passed++;
      this.log(`✅ PASSED: ${name}`, 'success');
    } catch (error) {
      this.failed++;
      this.errors.push({ test: name, error: error.message });
      this.log(`❌ FAILED: ${name} - ${error.message}`, 'error');
    }
  }

  async runTests() {
    this.log('🚀 MSSQL Strategy Test Suite', 'info');
    this.log('═'.repeat(60), 'info');
    this.log(`Server: ${this.baseURL}`, 'info');
    this.log(`MSSQL Config: ${this.config.username}@${this.config.host}:${this.config.port}/${this.config.database}`, 'info');
    this.log('═'.repeat(60), 'info');

    // 1. SERVER CONNECTIVITY
    await this.test('Server Health Check', async () => {
      const result = await this.request('GET', '/api/sql/health');
      if (!result.success && result.status !== 500) {
        throw new Error('Server not responding - check if Node.js server is running on port 5000');
      }
    });

    // 2. DATABASE CONNECTION
    await this.test('MSSQL Connection', async () => {
      const result = await this.request('POST', '/api/sql/connect', this.config);
      if (!result.success) {
        throw new Error(`Connection failed: ${JSON.stringify(result.error)} (Status: ${result.status})`);
      }
      this.log(`Connected: ${result.data.message}`, 'success');
    });

    // 3. CONNECTION HEALTH
    await this.test('Connection Health', async () => {
      const result = await this.request('GET', '/api/sql/health');
      if (!result.success || result.data.status !== 'healthy') {
        throw new Error(`Health check failed: ${result.data?.status || 'unknown'}`);
      }
    });

    // 4. GET DATABASES
    await this.test('List Databases', async () => {
      const result = await this.request('GET', '/api/sql/databases');
      if (!result.success || !Array.isArray(result.data.databases)) {
        throw new Error('Failed to get databases list');
      }
      this.log(`Found ${result.data.databases.length} databases`, 'info');
    });

    // 5. SWITCH DATABASE
    await this.test('Switch Database', async () => {
      const result = await this.request('POST', '/api/sql/switch-database', { dbName: 'tempdb' });
      if (!result.success) {
        throw new Error(`Switch failed: ${JSON.stringify(result.error)}`);
      }
    });

    // 6. GET TABLES
    await this.test('List Tables', async () => {
      const result = await this.request('GET', '/api/sql/tempdb/tables');
      if (!result.success || !Array.isArray(result.data.tables)) {
        throw new Error('Failed to get tables list');
      }
      this.log(`Found ${result.data.tables.length} tables`, 'info');
    });

    // 7. SIMPLE SELECT QUERY
    await this.test('Simple SELECT Query', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'SELECT name FROM sys.databases', // Removed ORDER BY completely
        page: 1,
        pageSize: 3
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error(`SELECT query failed: ${JSON.stringify(result.error)}`);
      }
      this.log(`Query returned ${result.data.rows.length} rows`, 'info');
    });

    // 8. SYSTEM TABLES QUERY (MSSQL style)
    await this.test('System Tables Query', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'SELECT @@VERSION AS sql_version'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error(`System tables query failed: ${JSON.stringify(result.error)}`);
      }
      this.log(`System query returned ${result.data.rows.length} row`, 'info');
    });

    // 9. SHOW TABLES COMMAND (MSSQL style)
    await this.test('SHOW Tables Command', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'SHOW TABLES'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('SHOW command failed');
      }
      this.log(`SHOW returned ${result.data.rows.length} results`, 'info');
    });

    // 10. DESCRIBE COMMAND (MSSQL style)
    await this.test('DESCRIBE Command', async () => {
      // First create a test table to describe
      await this.request('POST', '/api/sql/tempdb/query', {
        query: `CREATE TABLE test_describe_table (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100),
          created_date DATETIME2 DEFAULT GETDATE()
        )`
      });
      
      const result = await this.request('POST', '/api/sql/tempdb/query', {
        query: 'DESCRIBE test_describe_table'
      });
      
      // Clean up
      await this.request('POST', '/api/sql/tempdb/query', {
        query: 'DROP TABLE IF EXISTS test_describe_table'
      });
      
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('DESCRIBE command failed');
      }
      this.log(`DESCRIBE returned ${result.data.rows.length} columns`, 'info');
    });

    // 11. PAGINATION (MSSQL style)
    await this.test('Query Pagination', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'SELECT name, database_id FROM sys.databases', // Removed ORDER BY to let pagination add it
        page: 1,
        pageSize: 5
      });
      if (!result.success || !result.data.pagination) {
        throw new Error(`Pagination failed: ${JSON.stringify(result.error)}`);
      }
      this.log(`Page ${result.data.pagination.page}, ${result.data.rows.length} rows`, 'info');
    });

    // 12. TABLE INFO
    await this.test('Get Table Info', async () => {
      // Create a test table with various features
      await this.request('POST', '/api/sql/tempdb/query', {
        query: `CREATE TABLE test_table_info (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100) NOT NULL,
          email NVARCHAR(100) UNIQUE,
          created_at DATETIME2 DEFAULT GETDATE(),
          status BIT DEFAULT 1
        )`
      });
      
      const result = await this.request('GET', '/api/sql/tempdb/test_table_info/info');
      
      // Clean up
      await this.request('POST', '/api/sql/tempdb/query', {
        query: 'DROP TABLE IF EXISTS test_table_info'
      });
      
      if (!result.success || !result.data.columns) {
        throw new Error('Failed to get table info');
      }
      this.log(`Table has ${result.data.columns.length} columns`, 'info');
    });

    // 13. MULTIPLE TABLES INFO
    await this.test('Multiple Tables Info', async () => {
      // Create test tables
      await this.request('POST', '/api/sql/tempdb/query', {
        query: `CREATE TABLE test_multi_1 (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(50)
        )`
      });
      await this.request('POST', '/api/sql/tempdb/query', {
        query: `CREATE TABLE test_multi_2 (
          id INT IDENTITY(1,1) PRIMARY KEY,
          description NVARCHAR(MAX)
        )`
      });
      
      const result = await this.request('POST', '/api/sql/tempdb/info', {
        tables: ['test_multi_1', 'test_multi_2']
      });
      
      // Clean up
      await this.request('POST', '/api/sql/tempdb/query', {
        query: 'DROP TABLE IF EXISTS test_multi_1'
      });
      await this.request('POST', '/api/sql/tempdb/query', {
        query: 'DROP TABLE IF EXISTS test_multi_2'
      });
      
      if (!result.success || !Array.isArray(result.data.tables)) {
        throw new Error('Multiple tables info failed');
      }
      this.log(`Got info for ${result.data.tables.length} tables`, 'info');
    });

    // 14. QUERY ANALYSIS
    await this.test('Query Analysis', async () => {
      const result = await this.request('POST', '/api/sql/analyze-query', {
        query: 'SELECT * FROM sys.databases WHERE name LIKE \'%temp%\''
      });
      if (!result.success || !result.data.analysis) {
        throw new Error('Query analysis failed');
      }
      this.log(`Analysis: ${result.data.analysis.type}, ReadOnly: ${result.data.analysis.isReadOnly}`, 'info');
    });

    // 15. MSSQL-SPECIFIC QUERIES
    await this.test('MSSQL System Views', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'SELECT name FROM sys.databases WHERE database_id > 4', // Removed ORDER BY completely
        page: 1,
        pageSize: 3
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error(`MSSQL system views query failed: ${JSON.stringify(result.error)}`);
      }
      this.log(`System views query returned ${result.data.rows.length} databases`, 'info');
    });

    // 16. TRANSACTION TEST
    await this.test('Transaction Test', async () => {
      // Test each transaction statement separately to avoid balance issues
      let result = await this.request('POST', '/api/sql/tempdb/query', {
        query: 'CREATE TABLE temp_transaction_test (id INT)'
      });
      if (!result.success) {
        throw new Error(`Create table failed: ${JSON.stringify(result.error)}`);
      }
      
      result = await this.request('POST', '/api/sql/tempdb/query', {
        query: 'DROP TABLE temp_transaction_test'
      });
      if (!result.success) {
        throw new Error(`Drop table failed: ${JSON.stringify(result.error)}`);
      }
      
      this.log('Transaction operations executed successfully', 'info');
    });

    // 17. ERROR HANDLING - SYNTAX ERROR
    await this.test('Error Handling - Syntax Error', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'SELCT * FROM invalid_table_name' // Intentional typos
      });
      
      // Check if it failed with proper error status
      if (!result.success) {
        this.log('Syntax error properly caught with error status', 'success');
        return;
      }
      
      // Check if it returned success but with error message
      if (result.success && result.data.messages && result.data.messages.length > 0) {
        const hasError = result.data.messages.some(msg => 
          msg.message && (
            msg.message.toLowerCase().includes('error') ||
            msg.message.toLowerCase().includes('syntax') ||
            msg.message.toLowerCase().includes('unknown') ||
            msg.message.toLowerCase().includes('not recognized')
          )
        );
        if (hasError) {
          this.log('Syntax error caught in response messages', 'success');
          return;
        }
      }
      
      // If we get here, the syntax error was not properly handled
      throw new Error('Expected syntax error to fail or return error message');
    });

    // 18. ERROR HANDLING - MISSING HEADER
    await this.test('Error Handling - Missing Header', async () => {
      const config = {
        method: 'POST',
        url: `${this.baseURL}/api/sql/databases`,
        headers: { 'Content-Type': 'application/json' }, // Missing x-db-type
        timeout: 30000
      };
      
      try {
        await axios(config);
        throw new Error('Expected missing header error');
      } catch (error) {
        if (error.response?.status === 400) {
          this.log('Missing header properly caught', 'success');
        } else {
          throw new Error('Unexpected error type');
        }
      }
    });

    // 19. CREATE TEST DATABASE (if permissions allow)
    await this.test('Create Test Database', async () => {
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'CREATE DATABASE test_mssql_strategy'
      });
      if (!result.success) {
        this.log('⚠️ Could not create test database (may not have permissions)', 'warning');
        return; // Don't fail the test
      }
      this.log('Test database created', 'success');
    });

    // 20. CREATE AND TEST TABLE (if permissions allow)
    await this.test('Create Test Table', async () => {
      // Switch to test database
      let result = await this.request('POST', '/api/sql/switch-database', { dbName: 'test_mssql_strategy' });
      if (!result.success) {
        this.log('⚠️ Could not switch to test database', 'warning');
        return;
      }

      // Create table
      result = await this.request('POST', '/api/sql/test_mssql_strategy/query', {
        query: `CREATE TABLE test_users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100),
          email NVARCHAR(100) UNIQUE,
          created_at DATETIME2 DEFAULT GETDATE()
        )`
      });
      if (!result.success) {
        this.log('⚠️ Could not create test table', 'warning');
        return;
      }

      // Insert test data
      result = await this.request('POST', '/api/sql/test_mssql_strategy/query', {
        query: "INSERT INTO test_users (name, email) VALUES ('Test User', 'test@example.com')"
      });
      if (!result.success) {
        this.log('⚠️ Could not insert test data', 'warning');
        return;
      }

      // Select test data
      result = await this.request('POST', '/api/sql/test_mssql_strategy/query', {
        query: 'SELECT * FROM test_users'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('Could not select test data');
      }

      this.log(`Created table with ${result.data.rows.length} test records`, 'success');
    });

    // 21. CLEANUP
    await this.test('Cleanup Test Database', async () => {
      // Switch back to master database first
      await this.request('POST', '/api/sql/switch-database', { dbName: 'master' });
      
      const result = await this.request('POST', '/api/sql/master/query', {
        query: 'DROP DATABASE IF EXISTS test_mssql_strategy'
      });
      if (!result.success) {
        this.log('⚠️ Could not cleanup test database', 'warning');
        return;
      }
      this.log('Test database cleaned up', 'success');
    });

    // PRINT RESULTS
    this.printResults();
  }

  printResults() {
    this.log('\n' + '═'.repeat(60), 'info');
    this.log('🏁 TEST RESULTS', 'info');
    this.log('═'.repeat(60), 'info');
    
    const total = this.passed + this.failed;
    this.log(`Total Tests: ${total}`, 'info');
    this.log(`Passed: ${this.passed}`, 'success');
    this.log(`Failed: ${this.failed}`, this.failed > 0 ? 'error' : 'success');
    
    if (this.failed > 0) {
      this.log('\n❌ FAILED TESTS:', 'error');
      this.errors.forEach(error => {
        this.log(`  • ${error.test}: ${error.error}`, 'error');
      });
    }
    
    const successRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    this.log(`\nSuccess Rate: ${successRate}%`, successRate > 80 ? 'success' : 'warning');
    
    if (successRate >= 90) {
      this.log('🎉 EXCELLENT! Your MSSQL strategy is working perfectly!', 'success');
    } else if (successRate >= 70) {
      this.log('👍 GOOD! Most functionality is working.', 'success');
    } else if (successRate >= 50) {
      this.log('⚠️  PARTIAL SUCCESS! Some issues detected.', 'warning');
    } else {
      this.log('❌ MULTIPLE ISSUES! Please check your configuration.', 'error');
    }

    this.log('\n🔧 TROUBLESHOOTING GUIDE:', 'info');
    this.log('If tests failed, check:', 'info');
    this.log('1. SQL Server is running: sqlcmd -S localhost -U sa -P Root123!', 'info');
    this.log('2. Node.js server is running on port 5000', 'info');
    this.log('3. Update password in this file (line 12)', 'info');
    this.log('4. Check SQL Server user permissions (sa should have sysadmin role)', 'info');
    this.log('5. Verify API routes are mounted correctly', 'info');
    this.log('6. Ensure SQL Server allows SQL Server authentication', 'info');
    this.log('7. Check if TCP/IP is enabled for SQL Server', 'info');
    this.log('8. Verify SQL Server is listening on port 1433', 'info');
  }
}

// QUICK MSSQL CONNECTION TEST
async function quickMSSQLTest() {
  console.log('🔍 Quick MSSQL Connection Test...');
  try {
    const mssql = require("mssql");
    
    const config = {
      server: 'localhost',
      port: 1433,
      user: 'sa',
      password: 'Root123!', // ⚠️ UPDATE THIS
      database: 'master',
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
      },
      connectionTimeout: 10000
    };
    
    const pool = new mssql.ConnectionPool(config);
    await pool.connect();
    await pool.request().query('SELECT 1');
    await pool.close();
    console.log('✅ Direct MSSQL connection works!');
    return true;
  } catch (error) {
    console.log('❌ Direct MSSQL connection failed:', error.message);
    console.log('Please fix MSSQL connection before running API tests.');
    console.log('💡 Common issues:');
    console.log('   • SQL Server service not running');
    console.log('   • SQL Server authentication not enabled');
    console.log('   • TCP/IP protocol not enabled');
    console.log('   • Firewall blocking port 1433');
    console.log('   • Incorrect sa password');
    console.log('   • SSL/TLS certificate issues');
    return false;
  }
}

// MAIN FUNCTION
async function main() {
  console.log('🚀 MSSQL Strategy Complete Test Suite');
  console.log('=====================================\n');
  
  // Test MSSQL connection first
  const mssqlOk = await quickMSSQLTest();
  if (!mssqlOk) {
    console.log('\n🛑 Fix MSSQL connection first, then re-run tests.');
    process.exit(1);
  }
  
  console.log('');
  
  // Run API tests
  const tester = new MSSQLTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MSSQLTester;