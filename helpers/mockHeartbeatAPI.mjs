/**
 * @return {Promise<boolean>}
 */
export async function mockHeartbeatAPI() {
  return Math.random() > 0.5;
}
