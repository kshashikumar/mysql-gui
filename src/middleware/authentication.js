const authController = require("../controllers/authController");
require('dotenv').config();

function authentication(req, res, next) {

  console.log("Authentication middleware hit");
  console.log(req.headers['x-db-type']);
  console.log("Request path:", req.path);
  
  if (req.method === 'OPTIONS') {
    return next(); // Skip auth for OPTIONS
  }

  if (!process.env.DBFUSE_USERNAME || !process.env.DBFUSE_PASSWORD) {
    return next();
  }

    if(req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/logout') || req.path.startsWith('/api/auth/isAuthenticated')) {
    return next(); // Skip authentication for auth routes
  }

  const authHeader = req.headers.authorization;
  console.log("Authorization header:", authHeader);
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="user_pages"');
    return res.status(401).send('Authentication required!');
  }

  const [username, password] = authController._decodeCredentials(authHeader);
  if (username === process.env.DBFUSE_USERNAME && password === process.env.DBFUSE_PASSWORD) {
    console.log("User is authenticated");
    return next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="user_pages"');
    return res.status(401).send('Authentication required!');
  }
}

module.exports = {  
  authentication
};
