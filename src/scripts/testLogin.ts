async function testLogin() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@drivevue.com', password: 'Rahim321' }),
    });
    const data = await res.json();
    console.log('HTTP Status:', res.status);
    console.log('Login Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testLogin();
