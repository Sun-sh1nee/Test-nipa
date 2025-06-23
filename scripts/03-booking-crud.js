import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export let errorRate = new Rate('errors') ;
export let loginLatency = new Trend('login_latency');
export let createBookingLatency = new Trend('create_booking_latency');
export let updateBookingLatency = new Trend('update_booking_latency');
export let getBookingLatency = new Trend('get_booking_latency');
export let getBookingIDLatency = new Trend('get_booking_id_latency');
export let deleteBookingLatency = new Trend('delete_booking_latency');
export let logoutLatency = new Trend('logout_latency');

export let options = {
    vus: 50 ,
    duration: '1m',
    thresholds: {
    http_req_duration: ['p(95)<500' , 'p(99)<1000'], // 95% of requests < 500ms
    'errors': ['rate<0.05'], // < 5% error rate
  }
};

const BASE_URL =  'http://cuintern.com/api';

function retryRequest(requestFunc, retries = 3, initialDelayMs = 200) {
  for (let i = 0; i < retries; i++) {
    const res = requestFunc();
    if (res && res.status !== 0) {
      return res;
    }
    sleep(initialDelayMs / 1000 * Math.pow(2, i)); // Exponential backoff sleep
  }
  return null;
}
function generateRandomBooking() {
    // สุ่ม 2 ตัวอักษรภาษาอังกฤษ
    const randomLetters = () => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return letters.charAt(Math.floor(Math.random() * 26)) +
               letters.charAt(Math.floor(Math.random() * 26));
    };

    // สุ่มเลข 3 หลัก
    const randomDigits = () => String(Math.floor(100 + Math.random() * 900)); // 100-999

    // สุ่มวันที่ในช่วง 7 วันถัดไป
    const randomFutureDate = () => {
        const now = new Date();
        const future = new Date(now.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
        return future.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    // สุ่มเวลาในช่วง 6:00 ถึง 20:00
    const randomDepartureTime = () => {
        const hour = Math.floor(6 + Math.random() * 14); // 6-19
        const minute = Math.floor(Math.random() * 60);
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    };

    // คำนวณเวลา arrival โดยบวก 2 ชม.
    const calculateArrival = (dateStr, timeStr) => {
        const [hour, minute] = timeStr.split(':').map(Number);
        const depDate = new Date(`${dateStr}T${timeStr}`);
        const arrDate = new Date(depDate.getTime() + 2 * 60 * 60 * 1000); // +2 ชั่วโมง

        const arrivalDate = arrDate.toISOString().split('T')[0];
        const arrTime = `${String(arrDate.getHours()).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')}:00`;

        return { arrivalDate, arrivalTime: arrTime };
    };

    // สุ่ม seat_number เช่น 12A
    const randomSeatNumber = () => {
        const seatNum = Math.floor(1 + Math.random() * 99);
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const letter = letters.charAt(Math.floor(Math.random() * 6)); // A-F สมจริงกว่า
        return `${seatNum}${letter}`;
    };
    const randomGateNumber = () => {
    const letters = 'ABCDEFGH';
    const letter = letters.charAt(Math.floor(Math.random() * letters.length));
    const number = Math.floor(1 + Math.random() * 20); // 1–20
    return `${letter}${number}`;
};

    // === รวบรวม ===
    const departure_date = randomFutureDate();
    const departure_time = randomDepartureTime();
    const { arrivalDate, arrivalTime } = calculateArrival(departure_date, departure_time);

    return {
        departure_location: "Bangkok (BKK)",
        destination_location: "Chiang Mai (CNX)",
        departure_latitude: 13.7563,
        departure_longitude: 100.5018,
        destination_latitude: 18.7669,
        destination_longitude: 98.962,
        flight_number: randomLetters() + randomDigits(),
        departure_date: departure_date,
        departure_time: departure_time,
        arrival_date: arrivalDate,
        arrival_time: arrivalTime,
        seat_number: randomSeatNumber(),
        gate_number: randomGateNumber(),
        ticket_price: 2500.00,
    };
}
/**
 * Compares two booking data objects for equality, normalizing certain fields.
 * @param {Object} expected - The expected booking data.
 * @param {Object} actual - The actual booking data received from the API.
 * @returns {boolean} True if the booking data fields are equal after normalization, false otherwise.
 */
function isBookingDataEqual(expected, actual) {
    const keysToCheck = [
        'departure_location',
        'destination_location',
        'departure_latitude',
        'departure_longitude',
        'destination_latitude',
        'destination_longitude',
        'flight_number',
        'departure_date',
        'departure_time',
        'arrival_date',
        'arrival_time',
        'seat_number',
        'gate_number',
        'ticket_price'
    ];

    // Ensure actual is not null/undefined before checking keys
    if (!actual) {
        console.error('Actual booking data is null or undefined.');
        return false;
    }

    return keysToCheck.every((key) => {
        // Normalize both expected and actual values for consistent comparison
        const expectedVal = normalizeValue(expected[key]);
        const actualVal = normalizeValue(actual[key]);

        // console.log(`Comparing ${key}: Expected='${expectedVal}', Actual='${actualVal}'`); // For debugging
        return expectedVal === actualVal;
    });
}

/**
 * Helper function to normalize values for consistent comparison.
 * Handles numbers (to fixed 2 decimal places), ISO date strings (to YYYY-MM-DD),
 * and time strings (to HH:MM).
 * @param {*} value - The value to normalize.
 * @returns {*} The normalized value.
 */
function normalizeValue(value) {
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value))) {
        // Convert to number first, then to fixed 2 string for consistent price comparison
        return parseFloat(value).toFixed(2);
    }
    if (typeof value === 'string') {
        // Handle ISO date strings (e.g., "2023-10-27T00:00:00.000Z")
        if (value.includes('T') && value.includes('Z')) {
            return value.split('T')[0]; // Extract YYYY-MM-DD
        }
        // Handle time strings (e.g., "10:30:00" or "10:30")
        // This regex matches HH:MM and HH:MM:SS formats
        if (value.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
            return value.substring(0, 5); // Return HH:MM
        }
    }
    // For all other types or unmatched string formats, return as is
    return value;
}


export default function() {
    
    // --------------------------
    // 1. Log In
    // --------------------------
    
    const username = 'admin';
    const password = 'password';
    const headers = { 'Content-Type': 'application/json' };
    const loginPayload = JSON.stringify({
    username,
    password
  });

    const loginRes = retryRequest(() =>
    http.post(`${BASE_URL}/auth/login`, loginPayload, { headers }), 3, 200);

    
    if (loginRes) {
    loginLatency.add(loginRes.timings.duration / 1000);
    }

    const loginOK = loginRes && check(loginRes, {
    'login: status is 200': (r) => r.status === 200,
    'login: has body': (r) => r.body && r.body.length > 0,
    'login: token exists': (r) => {
      if (r.status !== 200 || !r.body) return false;
      try {
        return r.json('data.token') !== undefined;
      } catch {
        return false;
      }
    },
  });
    errorRate.add(!loginOK);
    if (!loginOK) return;

    const token = loginRes.json('data.token');
    const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
    sleep(1);

    // --------------------------
    // 2. Create Booking
    // --------------------------
    const bookingData = generateRandomBooking();
    const Booking = JSON.stringify(bookingData);

    const createBookingRes = retryRequest(()=>
    http.post(`${BASE_URL}/bookings` ,Booking, {headers: authHeaders }),3,200);
    
    if (createBookingRes) {
    createBookingLatency.add(createBookingRes.timings.duration / 1000);
}

    const createdBooking = createBookingRes.json('data.booking');

    const createBookingOK = createBookingRes && check(createBookingRes , {
        'Create Booking: status is 201': (r) => r.status === 201,
        'Create Booking: has body': (r) => r.body && r.body.length > 0,
        'Create Booking: success': (r) => {
            if(r.json('success') === true) return true ;
            else return false ;
        },
        'Create Booking: accuracy of data': (r) =>
        isBookingDataEqual(bookingData, createdBooking),
        });


    const bookingID = createBookingRes.json('data.booking.id') ;
    errorRate.add(!createBookingOK);
    sleep(1);

    // --------------------------
    // 3. Update Booking
    // --------------------------
    const updatebookingData = generateRandomBooking();
    const updateBooking = JSON.stringify(updatebookingData);

    const updateBookingRes = retryRequest(()=>
    http.put(`${BASE_URL}/bookings/${bookingID}` ,updateBooking, {headers: authHeaders }),3,200);

    
    if (updateBookingRes) {
    updateBookingLatency.add(updateBookingRes.timings.duration / 1000);
}

    const updatedBooking = updateBookingRes.json('data.booking');

    const updateBookingOK = updateBookingRes && check(updateBookingRes , {
        'Update Booking: status is 200': (r) => r.status === 200,
        'Update Booking: has body': (r) => r.body && r.body.length > 0,
        'Update Booking: success': (r) => {
            if(r.json('success') === true) return true ;
            else return false ;
        },
        'Update Booking: accuracy of data': (r) =>
        isBookingDataEqual(updatebookingData, updatedBooking),
    });
    errorRate.add(!updateBookingOK);
    sleep(1);

    // --------------------------
    // 4. Get Booking
    // --------------------------
    const getBookingRes = retryRequest(()=>
    http.get(`${BASE_URL}/bookings` ,{headers: authHeaders }),3,200);

    
    if (getBookingRes) {
    getBookingLatency.add(getBookingRes.timings.duration / 1000);
}

    const getBookingOK = getBookingRes && check(getBookingRes , {
        'Get Booking: status is 200': (r) => r.status === 200,
        'Get Booking: has body': (r) => r.body && r.body.length > 0,
        'Get Booking: success': (r) => {
            if(r.json('success') === true) return true ;
            else return false ;
        },
    });

    errorRate.add(!getBookingOK);
    sleep(1);
    // --------------------------
    // 4.1 Get Booking by Booking ID
    // --------------------------
    const getBookingIDRes = retryRequest(()=>
    http.get(`${BASE_URL}/bookings/${bookingID}` ,{headers: authHeaders }),3,200);

    
    if (getBookingIDRes) {
    getBookingIDLatency.add(getBookingIDRes.timings.duration / 1000);
}

    const getBookingIDOK = getBookingIDRes && check(getBookingIDRes , {
        'Get Booking ID: status is 200': (r) => r.status === 200,
        'Get Booking ID: has body': (r) => r.body && r.body.length > 0,
        'Get Booking ID: accuracy of data': (r) => {
            return r.json('data.booking.id') === bookingID ;
        },
    });

    errorRate.add(!getBookingIDOK);
    sleep(1);
    // --------------------------
    // 5. Delete Booking
    // --------------------------
    const deleteBookingRes = retryRequest(()=>
    http.del(`${BASE_URL}/bookings/${bookingID}`,null,{headers: authHeaders }),3,200);

    
    if (deleteBookingRes) {
    deleteBookingLatency.add(deleteBookingRes.timings.duration / 1000);
}

    const deleteBookingOK = deleteBookingRes && check(deleteBookingRes , {
        'Delete Booking: status is 200': (r) => r.status === 200,
        'Delete Booking: has body': (r) => r.body && r.body.length > 0,
        'Delete Booking: success': (r) => {
            if(r.json('success') === true) return true ;
            else return false ;
        },
        'Delete Booking: accuracy of data': (r) => {
            return r.json('data.deleted_booking_id') === `${bookingID}` ;
        }
    });
    errorRate.add(!deleteBookingOK);
    sleep(1);

    //----------------------------
    // 6. Log out
    //----------------------------
      const logoutRes = retryRequest(() =>
        http.post(`${BASE_URL}/auth/logout` ,null, {headers: authHeaders}),3,200) ;
    if (logoutRes) {
    logoutLatency.add(logoutRes.timings.duration / 1000);
}
    
      const logoutOK = logoutRes && check(logoutRes, {
        'logout : status is 200': (r) => r.status === 200 ,
      });
    
      errorRate.add(!logoutOK);
      sleep(1);
}