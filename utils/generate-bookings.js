// generate-bookings.js
const axios = require('axios');
const { faker } = require('@faker-js/faker');


const BASE_URL = process.env.BASE_URL || 'http://localhost/api';
const USER_CREDENTIALS = {
  username: 'admin',
  password: 'password',
};

const NUM_BOOKINGS = 10000;

async function login() {
  const response = await axios.post(`${BASE_URL}/auth/login`, USER_CREDENTIALS);
  return response.data.data.token;
}

async function createBooking(token) {
  const data = {
    departure_location: faker.location.city(),
    destination_location: faker.location.city(),
    departure_latitude: faker.location.latitude(),
    departure_longitude: faker.location.longitude(),
    destination_latitude: faker.location.latitude(),
    destination_longitude: faker.location.longitude(),
    flight_number: faker.string.alphanumeric(6).toUpperCase(),
    departure_date: faker.date.future().toISOString().split('T')[0],
    departure_time: '09:00:00',
    arrival_date: faker.date.future().toISOString().split('T')[0],
    arrival_time: '11:00:00',
    seat_number: `A${faker.number.int({ min: 1, max: 30 })}`,
    gate_number: `G${faker.number.int({ min: 1, max: 5 })}`,
    ticket_price: faker.commerce.price(500, 10000, 2),
  };

  return axios.post(`${BASE_URL}/bookings`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function main() {
  try {
    const token = await login();
    console.log(`✅ Logged in. Token acquired.`);

    for (let i = 0; i < NUM_BOOKINGS; i++) {
      try {
        await createBooking(token);
        process.stdout.write(`📦 ${i + 1}/${NUM_BOOKINGS}\r`);
      } catch (err) {
        console.error(`❌ Error on booking ${i + 1}:`, err.response?.data || err.message);
      }
    }

    console.log(`\n✅ Created ${NUM_BOOKINGS} bookings successfully.`);
  } catch (err) {
    console.error('🚫 Login failed:', err.response?.data || err.message);
  }
}

main();


// npm install @faker-js/faker axios
// node generate-bookings.js