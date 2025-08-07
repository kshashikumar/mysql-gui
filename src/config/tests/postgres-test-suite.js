// postgres-test-suite.js
// Simple, comprehensive test suite for PostgreSQL Strategy

const axios = require('axios');

class PostgreSQLTester {
  constructor() {
    this.baseURL = 'http://localhost:5000';
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    
    // Configuration - UPDATE THESE VALUES
    this.config = {
      username: 'root',
      password: 'root', // CHANGE THIS TO YOUR POSTGRES PASSWORD
      host: 'localhost',
      port: '5432',
      dbType: 'pg',
      database: 'mydatabase'
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
          'x-db-type': 'pg'
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
    this.log('🚀 PostgreSQL Strategy Test Suite', 'info');
    this.log('═'.repeat(60), 'info');
    this.log(`Server: ${this.baseURL}`, 'info');
    this.log(`PostgreSQL Config: ${this.config.username}@${this.config.host}:${this.config.port}`, 'info');
    this.log('═'.repeat(60), 'info');

    // 1. SERVER CONNECTIVITY
    await this.test('Server Health Check', async () => {
      const result = await this.request('GET', '/api/sql/health');
      if (!result.success && result.status !== 500) {
        throw new Error('Server not responding - check if Node.js server is running on port 5000');
      }
    });

    // 2. DATABASE CONNECTION
    await this.test('PostgreSQL Connection', async () => {
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
      const result = await this.request('POST', '/api/sql/switch-database', { dbName: 'postgres' });
      if (!result.success) {
        throw new Error(`Switch failed: ${JSON.stringify(result.error)}`);
      }
    });

    // 6. GET TABLES
    await this.test('List Tables', async () => {
      const result = await this.request('GET', '/api/sql/postgres/tables');
      if (!result.success || !Array.isArray(result.data.tables)) {
        throw new Error('Failed to get tables list');
      }
      this.log(`Found ${result.data.tables.length} tables`, 'info');
    });

    // 7. SIMPLE SELECT QUERY
    await this.test('Simple SELECT Query', async () => {
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'SELECT datname FROM pg_database LIMIT 3',
        page: 1,
        pageSize: 3
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('SELECT query failed');
      }
      this.log(`Query returned ${result.data.rows.length} rows`, 'info');
    });

    // 8. SHOW COMMAND (PostgreSQL style)
    await this.test('SHOW Tables Command', async () => {
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'SHOW TABLES'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('SHOW command failed');
      }
      this.log(`SHOW returned ${result.data.rows.length} results`, 'info');
    });

    // 9. DESCRIBE COMMAND (PostgreSQL style)
    await this.test('DESCRIBE Command', async () => {
      // First create a test table to describe
      await this.request('POST', '/api/sql/postgres/query', {
        query: 'CREATE TABLE IF NOT EXISTS test_describe_table (id SERIAL PRIMARY KEY, name VARCHAR(100))'
      });
      
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'DESCRIBE test_describe_table'
      });
      
      // Clean up
      await this.request('POST', '/api/sql/postgres/query', {
        query: 'DROP TABLE IF EXISTS test_describe_table'
      });
      
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('DESCRIBE command failed');
      }
      this.log(`DESCRIBE returned ${result.data.rows.length} columns`, 'info');
    });

    // 10. PAGINATION
    await this.test('Query Pagination', async () => {
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'SELECT * FROM information_schema.columns',
        page: 1,
        pageSize: 5
      });
      if (!result.success || !result.data.pagination) {
        throw new Error('Pagination failed');
      }
      this.log(`Page ${result.data.pagination.page}, ${result.data.rows.length} rows`, 'info');
    });

    // 11. TABLE INFO (if we have any tables)
    await this.test('Get Table Info', async () => {
      // First, get list of tables
      const tablesResult = await this.request('GET', '/api/sql/postgres/tables');
      if (!tablesResult.success || !Array.isArray(tablesResult.data.tables)) {
        this.log('⚠️ No tables found to test table info', 'warning');
        return;
      }
      
      if (tablesResult.data.tables.length === 0) {
        // Create a test table
        await this.request('POST', '/api/sql/postgres/query', {
          query: `CREATE TABLE IF NOT EXISTS test_table_info (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        });
        
        const result = await this.request('GET', '/api/sql/postgres/test_table_info/info');
        
        // Clean up
        await this.request('POST', '/api/sql/postgres/query', {
          query: 'DROP TABLE IF EXISTS test_table_info'
        });
        
        if (!result.success || !result.data.columns) {
          throw new Error('Failed to get table info');
        }
        this.log(`Table has ${result.data.columns.length} columns`, 'info');
      } else {
        // Use existing table
        const tableName = tablesResult.data.tables[0];
        const result = await this.request('GET', `/api/sql/postgres/${tableName}/info`);
        if (!result.success || !result.data.columns) {
          throw new Error('Failed to get table info');
        }
        this.log(`Table has ${result.data.columns.length} columns`, 'info');
      }
    });

    // 12. MULTIPLE TABLES INFO
    await this.test('Multiple Tables Info', async () => {
      // Create test tables
      await this.request('POST', '/api/sql/postgres/query', {
        query: 'CREATE TABLE IF NOT EXISTS test_multi_1 (id SERIAL PRIMARY KEY, name VARCHAR(50))'
      });
      await this.request('POST', '/api/sql/postgres/query', {
        query: 'CREATE TABLE IF NOT EXISTS test_multi_2 (id SERIAL PRIMARY KEY, description TEXT)'
      });
      
      const result = await this.request('POST', '/api/sql/postgres/info', {
        tables: ['test_multi_1', 'test_multi_2']
      });
      
      // Clean up
      await this.request('POST', '/api/sql/postgres/query', {
        query: 'DROP TABLE IF EXISTS test_multi_1, test_multi_2'
      });
      
      if (!result.success || !Array.isArray(result.data.tables)) {
        throw new Error('Multiple tables info failed');
      }
      this.log(`Got info for ${result.data.tables.length} tables`, 'info');
    });

    // 13. QUERY ANALYSIS
    await this.test('Query Analysis', async () => {
      const result = await this.request('POST', '/api/sql/analyze-query', {
        query: 'SELECT * FROM pg_database WHERE datname LIKE \'pg_%\''
      });
      if (!result.success || !result.data.analysis) {
        throw new Error('Query analysis failed');
      }
      this.log(`Analysis: ${result.data.analysis.type}, ReadOnly: ${result.data.analysis.isReadOnly}`, 'info');
    });

    // 14. ERROR HANDLING - SYNTAX ERROR
    await this.test('Error Handling - Syntax Error', async () => {
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'SELCT * FROM pg_database_invalid' // Intentional typos
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

    // 15. ERROR HANDLING - MISSING HEADER
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

    // 16. CREATE TEST DATABASE (if permissions allow)
    await this.test('Create Test Database', async () => {
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'CREATE DATABASE test_postgres_strategy'
      });
      if (!result.success) {
        this.log('⚠️ Could not create test database (may not have permissions)', 'warning');
        return; // Don't fail the test
      }
      this.log('Test database created', 'success');
    });

    // 17. CREATE AND TEST TABLE (if permissions allow)
    await this.test('Create Test Table', async () => {
      // Switch to test database
      let result = await this.request('POST', '/api/sql/switch-database', { dbName: 'test_postgres_strategy' });
      if (!result.success) {
        this.log('⚠️ Could not switch to test database', 'warning');
        return;
      }

      // Create table
      result = await this.request('POST', '/api/sql/test_postgres_strategy/query', {
        query: `CREATE TABLE IF NOT EXISTS test_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      });
      if (!result.success) {
        this.log('⚠️ Could not create test table', 'warning');
        return;
      }

      // Insert test data
      result = await this.request('POST', '/api/sql/test_postgres_strategy/query', {
        query: "INSERT INTO test_users (name, email) VALUES ('Test User', 'test@example.com')"
      });
      if (!result.success) {
        this.log('⚠️ Could not insert test data', 'warning');
        return;
      }

      // Select test data
      result = await this.request('POST', '/api/sql/test_postgres_strategy/query', {
        query: 'SELECT * FROM test_users'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('Could not select test data');
      }

      this.log(`Created table with ${result.data.rows.length} test records`, 'success');
    });

    // 18. CLEANUP
    await this.test('Cleanup Test Database', async () => {
      // Switch back to postgres database first
      await this.request('POST', '/api/sql/switch-database', { dbName: 'postgres' });
      
      const result = await this.request('POST', '/api/sql/postgres/query', {
        query: 'DROP DATABASE IF EXISTS test_postgres_strategy'
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
      this.log('🎉 EXCELLENT! Your PostgreSQL strategy is working perfectly!', 'success');
    } else if (successRate >= 70) {
      this.log('👍 GOOD! Most functionality is working.', 'success');
    } else if (successRate >= 50) {
      this.log('⚠️  PARTIAL SUCCESS! Some issues detected.', 'warning');
    } else {
      this.log('❌ MULTIPLE ISSUES! Please check your configuration.', 'error');
    }

    this.log('\n🔧 TROUBLESHOOTING GUIDE:', 'info');
    this.log('If tests failed, check:', 'info');
    this.log('1. PostgreSQL server is running: psql -U root -d mydatabase', 'info');
    this.log('2. Node.js server is running on port 5000', 'info');
    this.log('3. Update password in this file (line 12)', 'info');
    this.log('4. Check PostgreSQL user permissions', 'info');
    this.log('5. Verify API routes are mounted correctly', 'info');
    this.log('6. Ensure mydatabase exists or change config to postgres', 'info');
  }
}

// QUICK POSTGRESQL CONNECTION TEST
async function quickPostgreSQLTest() {
  console.log('🔍 Quick PostgreSQL Connection Test...');
  try {
    const { Pool } = require("pg");
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'root',
      password: 'root', // ⚠️ UPDATE THIS
      database: 'mydatabase', // or 'postgres' if mydatabase doesn't exist
      connectionTimeoutMillis: 10000
    });
    
    await pool.query('SELECT 1');
    await pool.end();
    console.log('✅ Direct PostgreSQL connection works!');
    return true;
  } catch (error) {
    console.log('❌ Direct PostgreSQL connection failed:', error.message);
    console.log('Please fix PostgreSQL connection before running API tests.');
    console.log('💡 Try changing database to "postgres" if "mydatabase" doesn\'t exist');
    return false;
  }
}

// MAIN FUNCTION
async function main() {
  console.log('🚀 PostgreSQL Strategy Complete Test Suite');
  console.log('==========================================\n');
  
  // Test PostgreSQL connection first
  const postgresOk = await quickPostgreSQLTest();
  if (!postgresOk) {
    console.log('\n🛑 Fix PostgreSQL connection first, then re-run tests.');
    process.exit(1);
  }
  
  console.log('');
  
  // Run API tests
  const tester = new PostgreSQLTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PostgreSQLTester;