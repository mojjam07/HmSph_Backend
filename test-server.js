const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  const response = {
    message: 'Hello World',
    timestamp: new Date().toISOString(),
    status: 'OK'
  };

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(response));
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});
