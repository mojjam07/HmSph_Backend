const fetch = require('node-fetch');

async function getAdminToken() {
  const loginUrl = 'http://localhost:3000/api/auth/login';
  const adminCredentials = {
    email: 'admin@homesphere.com',
    password: 'admin123'
  };

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminCredentials)
    });

    if (!response.ok) {
      console.error('Login failed with status:', response.status);
      const errorData = await response.text();
      console.error('Error response:', errorData);
      return null;
    }

    const data = await response.json();
    if (data.token) {
      console.log('Admin token:', data.token);
      return data.token;
    } else {
      console.error('No token received in login response');
      return null;
    }
  } catch (error) {
    console.error('Error during login request:', error);
    return null;
  }
}

getAdminToken();
