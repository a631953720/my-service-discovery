const express = require('express');
const axios = require("axios");
const app = express();
const port = 5555;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/heartbeat', (req, res) => {
  console.log('heartbeat');
  res.status(200).send('echo');
});

// Start the server and listen on the specified port
app.listen(port, async () => {
  console.log(`Example app listening at http://localhost:${port}`);

  try {
    await axios.post('http://localhost:4000/api/register', {
      ip: '127.0.0.1:5555',
      name: 'services',
    });
  } catch (e) {
    console.log('register error');
  }
});
