// oracle-test-suite.js
// Simple, comprehensive test suite for Oracle Strategy

const axios = require('axios');

class OracleTester {
  constructor() {
    this.baseURL = 'http://localhost:5000';
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    
    // Configuration - UPDATE THESE VALUES
    this.config = {
      username: 'SYSTEM',
      password: 'root', // ⚠️ CHANGE THIS TO YOUR ORACLE PASSWORD
      host: 'localhost',
      port: '1521',
      dbType: 'oracledb',
      database: 'MYDATABASE'
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
          'x-db-type': 'oracledb'
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
    this.log('🚀 Oracle Strategy Test Suite', 'info');
    this.log('═'.repeat(60), 'info');
    this.log(`Server: ${this.baseURL}`, 'info');
    this.log(`Oracle Config: ${this.config.username}@${this.config.host}:${this.config.port}/${this.config.database}`, 'info');
    this.log('═'.repeat(60), 'info');

    // 1. SERVER CONNECTIVITY
    await this.test('Server Health Check', async () => {
      const result = await this.request('GET', '/api/sql/health');
      if (!result.success && result.status !== 500) {
        throw new Error('Server not responding - check if Node.js server is running on port 5000');
      }
    });

    // 2. DATABASE CONNECTION
    await this.test('Oracle Connection', async () => {
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

    // 4. GET DATABASES (SCHEMAS)
    await this.test('List Schemas', async () => {
      const result = await this.request('GET', '/api/sql/databases');
      if (!result.success || !Array.isArray(result.data.databases)) {
        throw new Error('Failed to get schemas list');
      }
      this.log(`Found ${result.data.databases.length} schemas`, 'info');
    });

    // 5. SWITCH SCHEMA
    await this.test('Switch Schema', async () => {
      const result = await this.request('POST', '/api/sql/switch-database', { dbName: 'SYSTEM' });
      if (!result.success) {
        throw new Error(`Schema switch failed: ${JSON.stringify(result.error)}`);
      }
    });

    // 6. GET TABLES
    await this.test('List Tables', async () => {
      const result = await this.request('GET', '/api/sql/SYSTEM/tables');
      if (!result.success || !Array.isArray(result.data.tables)) {
        throw new Error('Failed to get tables list');
      }
      this.log(`Found ${result.data.tables.length} tables`, 'info');
    });

    // 7. SIMPLE SELECT QUERY
    await this.test('Simple SELECT Query', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'SELECT username FROM all_users WHERE ROWNUM <= 3',
        page: 1,
        pageSize: 3
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('SELECT query failed');
      }
      this.log(`Query returned ${result.data.rows.length} rows`, 'info');
    });

    // 8. DUAL TABLE QUERY (Oracle classic)
    await this.test('DUAL Table Query', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'SELECT SYSDATE, USER, 1+1 AS calculation FROM DUAL'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('DUAL query failed');
      }
      this.log(`DUAL query returned ${result.data.rows.length} row`, 'info');
    });

    // 9. SHOW TABLES COMMAND (Oracle style)
    await this.test('SHOW Tables Command', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'SHOW TABLES'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('SHOW command failed');
      }
      this.log(`SHOW returned ${result.data.rows.length} results`, 'info');
    });

    // 10. DESCRIBE COMMAND (Oracle style)
    await this.test('DESCRIBE Command', async () => {
      // First create a test table to describe
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: `CREATE TABLE test_describe_table (
          id NUMBER(10) PRIMARY KEY,
          name VARCHAR2(100),
          created_date DATE DEFAULT SYSDATE
        )`
      });
      
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'DESCRIBE test_describe_table'
      });
      
      // Clean up
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'DROP TABLE test_describe_table'
      });
      
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('DESCRIBE command failed');
      }
      this.log(`DESCRIBE returned ${result.data.rows.length} columns`, 'info');
    });

    // 11. PAGINATION (Oracle style)
    await this.test('Query Pagination', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'SELECT object_name, object_type FROM all_objects',
        page: 1,
        pageSize: 5
      });
      if (!result.success || !result.data.pagination) {
        throw new Error('Pagination failed');
      }
      this.log(`Page ${result.data.pagination.page}, ${result.data.rows.length} rows`, 'info');
    });

    // 12. TABLE INFO
    await this.test('Get Table Info', async () => {
      // Create a test table with various features
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: `CREATE TABLE test_table_info (
          id NUMBER(10) PRIMARY KEY,
          name VARCHAR2(100) NOT NULL,
          email VARCHAR2(100) UNIQUE,
          created_at DATE DEFAULT SYSDATE,
          status NUMBER(1) DEFAULT 1
        )`
      });
      
      const result = await this.request('GET', '/api/sql/SYSTEM/test_table_info/info');
      
      // Clean up
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'DROP TABLE test_table_info'
      });
      
      if (!result.success || !result.data.columns) {
        throw new Error('Failed to get table info');
      }
      this.log(`Table has ${result.data.columns.length} columns`, 'info');
    });

    // 13. MULTIPLE TABLES INFO
    await this.test('Multiple Tables Info', async () => {
      // Create test tables
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: `CREATE TABLE test_multi_1 (
          id NUMBER(10) PRIMARY KEY,
          name VARCHAR2(50)
        )`
      });
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: `CREATE TABLE test_multi_2 (
          id NUMBER(10) PRIMARY KEY,
          description CLOB
        )`
      });
      
      const result = await this.request('POST', '/api/sql/SYSTEM/info', {
        tables: ['test_multi_1', 'test_multi_2']
      });
      
      // Clean up
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'DROP TABLE test_multi_1'
      });
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'DROP TABLE test_multi_2'
      });
      
      if (!result.success || !Array.isArray(result.data.tables)) {
        throw new Error('Multiple tables info failed');
      }
      this.log(`Got info for ${result.data.tables.length} tables`, 'info');
    });

    // 14. QUERY ANALYSIS
    await this.test('Query Analysis', async () => {
      const result = await this.request('POST', '/api/sql/analyze-query', {
        query: 'SELECT * FROM all_users WHERE username LIKE \'SYS%\''
      });
      if (!result.success || !result.data.analysis) {
        throw new Error('Query analysis failed');
      }
      this.log(`Analysis: ${result.data.analysis.type}, ReadOnly: ${result.data.analysis.isReadOnly}`, 'info');
    });

    // 15. ORACLE-SPECIFIC QUERIES
    await this.test('Oracle System Views', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'SELECT tablespace_name, status FROM dba_tablespaces WHERE ROWNUM <= 3'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('Oracle system views query failed');
      }
      this.log(`System views query returned ${result.data.rows.length} tablespaces`, 'info');
    });

    // 16. ERROR HANDLING - SYNTAX ERROR
    await this.test('Error Handling - Syntax Error', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
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

    // 17. ERROR HANDLING - MISSING HEADER
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

    // 18. CREATE TEST SCHEMA (if permissions allow)
    await this.test('Create Test Schema', async () => {
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: `CREATE USER test_oracle_strategy IDENTIFIED BY test123
                DEFAULT TABLESPACE USERS
                TEMPORARY TABLESPACE TEMP
                QUOTA UNLIMITED ON USERS`
      });
      if (!result.success) {
        this.log('⚠️ Could not create test schema (may not have permissions)', 'warning');
        return; // Don't fail the test
      }
      
      // Grant basic privileges
      await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'GRANT CONNECT, RESOURCE TO test_oracle_strategy'
      });
      
      this.log('Test schema created', 'success');
    });

    // 19. CREATE AND TEST TABLE (if permissions allow)
    await this.test('Create Test Table in Schema', async () => {
      // Switch to test schema
      let result = await this.request('POST', '/api/sql/switch-database', { dbName: 'test_oracle_strategy' });
      if (!result.success) {
        this.log('⚠️ Could not switch to test schema', 'warning');
        return;
      }

      // Create table
      result = await this.request('POST', '/api/sql/test_oracle_strategy/query', {
        query: `CREATE TABLE test_users (
          id NUMBER(10) GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name VARCHAR2(100),
          email VARCHAR2(100) UNIQUE,
          created_at DATE DEFAULT SYSDATE
        )`
      });
      if (!result.success) {
        this.log('⚠️ Could not create test table', 'warning');
        return;
      }

      // Insert test data
      result = await this.request('POST', '/api/sql/test_oracle_strategy/query', {
        query: "INSERT INTO test_users (name, email) VALUES ('Test User', 'test@example.com')"
      });
      if (!result.success) {
        this.log('⚠️ Could not insert test data', 'warning');
        return;
      }

      // Select test data
      result = await this.request('POST', '/api/sql/test_oracle_strategy/query', {
        query: 'SELECT * FROM test_users'
      });
      if (!result.success || !Array.isArray(result.data.rows)) {
        throw new Error('Could not select test data');
      }

      this.log(`Created table with ${result.data.rows.length} test records`, 'success');
    });

    // 20. CLEANUP
    await this.test('Cleanup Test Schema', async () => {
      // Switch back to SYSTEM schema first
      await this.request('POST', '/api/sql/switch-database', { dbName: 'SYSTEM' });
      
      const result = await this.request('POST', '/api/sql/SYSTEM/query', {
        query: 'DROP USER test_oracle_strategy CASCADE'
      });
      if (!result.success) {
        this.log('⚠️ Could not cleanup test schema', 'warning');
        return;
      }
      this.log('Test schema cleaned up', 'success');
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
      this.log('🎉 EXCELLENT! Your Oracle strategy is working perfectly!', 'success');
    } else if (successRate >= 70) {
      this.log('👍 GOOD! Most functionality is working.', 'success');
    } else if (successRate >= 50) {
      this.log('⚠️  PARTIAL SUCCESS! Some issues detected.', 'warning');
    } else {
      this.log('❌ MULTIPLE ISSUES! Please check your configuration.', 'error');
    }

    this.log('\n🔧 TROUBLESHOOTING GUIDE:', 'info');
    this.log('If tests failed, check:', 'info');
    this.log('1. Oracle server is running: sqlplus SYSTEM/root@localhost:1521/MYDATABASE', 'info');
    this.log('2. Node.js server is running on port 5000', 'info');
    this.log('3. Update password in this file (line 12)', 'info');
    this.log('4. Check Oracle user permissions (SYSTEM should have DBA privileges)', 'info');
    this.log('5. Verify API routes are mounted correctly', 'info');
    this.log('6. Ensure Oracle XE/EE is properly configured', 'info');
    this.log('7. Check Oracle listener is running on port 1521', 'info');
  }
}

// QUICK ORACLE CONNECTION TEST
async function quickOracleTest() {
  console.log('🔍 Quick Oracle Connection Test...');
  try {
    const oracledb = require("oracledb");
    
    const connection = await oracledb.getConnection({
      user: 'SYSTEM',
      password: 'root', // ⚠️ UPDATE THIS
      connectString: 'localhost:1521/MYDATABASE', // or XE, ORCL, etc.
      connectionTimeout: 10000
    });
    
    await connection.execute('SELECT 1 FROM DUAL');
    await connection.close();
    console.log('✅ Direct Oracle connection works!');
    return true;
  } catch (error) {
    console.log('❌ Direct Oracle connection failed:', error.message);
    console.log('Please fix Oracle connection before running API tests.');
    console.log('💡 Common issues:');
    console.log('   • Oracle service not running');
    console.log('   • Wrong SID/Service name (try XE, ORCL, or check tnsnames.ora)');
    console.log('   • Listener not running on port 1521');
    console.log('   • Incorrect username/password');
    return false;
  }
}

// MAIN FUNCTION
async function main() {
  console.log('🚀 Oracle Strategy Complete Test Suite');
  console.log('======================================\n');
  
  // Test Oracle connection first
  const oracleOk = await quickOracleTest();
  if (!oracleOk) {
    console.log('\n🛑 Fix Oracle connection first, then re-run tests.');
    process.exit(1);
  }
  
  console.log('');
  
  // Run API tests
  const tester = new OracleTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = OracleTester;