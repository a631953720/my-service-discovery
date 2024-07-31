import axios from 'axios';

/**
 * @param {string} ip
 * @param {boolean} isHttps
 * @return {Promise<boolean>}
 */
export async function heartbeatAPI(ip, isHttps) {
  try {
    const protocol = isHttps ? 'https' : 'http';
    const res = await axios.get(`${protocol}://${ip}/api/heartbeat`);
    return res.status === 200;
  } catch (e) {
    console.log('heartbeatAPI failed');
    return false;
  }
}
