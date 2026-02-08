const axios = require('axios');

async function testSingleLogin(email, password) {
    try {
        console.log(`Testing login for ${email}...`);
        const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
        console.log(`✅ Success: Status ${response.status}`);
        console.log('User returned:', response.data.user.email);
    } catch (error) {
        console.error(`❌ Failed: Status ${error.response?.status}`);
        console.error('Error body:', error.response?.data);
    }
}

async function run() {
    await testSingleLogin('manager@seatslabs.com', 'Password@123');
    console.log('---');
    await testSingleLogin('customer@seatslabs.com', 'Password@123');
}

run();
