import axios from "axios";

/**
 * @typedef {{
 *   ip: string;
 *   isOnline: boolean;
 *   isHttps: boolean;
 * } & Record<string, any>} Meta
 */

/**
 * @typedef {Map<string, ServiceWithMeta>} IPServiceMap
 */

/**
 * @typedef {{
 *   lastHeartbeatAt: Date;
 *   errorsCount: number;
 *   composeKey: string;
 * }} HeartbeatMeta
 */

/**
 * @return {Promise<boolean>}
 */
async function mockHeartbeatAPI() {
  return Math.random() > 0.5;
}

/**
 * @param {string} ip
 * @param {boolean} isHttps
 * @return {Promise<boolean>}
 */
async function heartbeatAPI(ip, isHttps) {
  try {
    const protocol = isHttps ? 'https' : 'http';
    const res = await axios.get(`${protocol}://${ip}/api/heartbeat`);
    return res.status === 200;
  } catch (e) {
    console.log('heartbeatAPI failed');
    return false;
  }
}

class ServiceWithMeta {
  /**
   * @param {string} name
   * @param {Meta} meta
   */
  constructor(name, meta) {
    this.name = name;
    this.ip = meta.ip;
    this.isOnline = meta.isOnline;
    this.isHttps = meta.isHttps;
  }

  toJSON() {
    return {
      name: this.name,
      ip: this.ip,
      isOnline: this.isOnline,
      isHttps: this.isHttps,
    }
  }
}

export class ServiceRegistry {
  /**
   * @type {boolean}
   */
  constructor(isMock) {
    this.isMock = isMock;
    this.isLocked = false;

    /**
     * @type {Map<string, IPServiceMap>}
     */
    this.map = new Map();
    /**
     * @type {Map<string, HeartbeatMeta>}
     */
    this.heartbeatMap = new Map();
  }

  /**
   * @param {string} name
   * @param {Meta} meta
   */
  register(name, meta) {
    if (this.isLocked) {
      throw new Error('register locked');
    }
    this.isLocked = true;

    if (!meta.ip || !name) {
      throw new Error('Missing IP address or service name');
    }

    /**
     * @type {IPServiceMap}
     */
    const ipServiceMap = this.map.get(name) ?? new Map();
    const service = ipServiceMap.get(meta.ip);
    if (service) {
      console.log(`register service ${service.name}-${meta.ip} has registered`);
      return;
    }

    ipServiceMap.set(meta.ip, new ServiceWithMeta(name, meta));
    this.map.set(name, ipServiceMap);

    const composeKey = this.composeKey(name, meta.ip);
    this.heartbeatMap.set(composeKey, {
      composeKey,
      errorsCount: 0,
      lastHeartbeatAt: new Date(),
    });
    this.isLocked = false;
  }

  /**
   * @param {string} name
   * @param {string} ip
   * @return {ServiceWithMeta | null}
   */
  getServiceWithMeta(name, ip) {
    return this.map.get(name)?.get(ip) ?? null;
  }

  /**
   * @param {string} name
   * @return {string[]}
   */
  getServiceIPList(name) {
    const ipServiceMap = this.map.get(name) ?? new Map();
    const ips = [];
    ipServiceMap.forEach((_, ip) => ips.push(ip));
    return ips;
  }

  /**
   * @return {ServiceWithMeta[]}
   */
  getAllServicesWithMeta() {
    const services = [];
    this.map.forEach((ipServiceMap) => {
      ipServiceMap.forEach((service) => {
        services.push(service);
      });
    });
    return services;
  };

  /**
   * @return {HeartbeatMeta[]}
   */
  getAllHeartbeatMeta() {
    const result = [];

    this.heartbeatMap.forEach((meta) => {
      result.push(meta);
    });

    return result;
  }

  /**
   * @param {string} name
   * @param {string} ip
   */
  removeServiceFromIPServiceMap(name, ip) {
    const ipServiceMap = this.map.get(name);
    ipServiceMap?.delete(ip);
    this.heartbeatMap.delete(this.composeKey(name, ip));
  }

  /**
   * @param {string} name
   * @param {string} ip
   */
  async heartbeat(name, ip) {
    const service = this.getServiceWithMeta(name, ip);
    if (!service) {
      console.log(`${service}-${ip} is not exist`);
      return;
    }

    const isAlive = this.isMock
      ? await mockHeartbeatAPI()
      : await heartbeatAPI(ip, service.isHttps);
    const composeKey = this.composeKey(name, ip);
    /**
     * @type HeartbeatMeta
     */
    const result = this.heartbeatMap.get(composeKey);
    if (!result) return;

    if (!isAlive) {
      console.log(`${name}-${ip} heartbeat failed`);
      result.errorsCount += 1;
    } else {
      console.log(`${name}-${ip} update heartbeat date`);
      result.date = new Date();
    }

    this.heartbeatMap.set(composeKey, result);
  }

  /**
   * @param {string} name
   * @param {string} ip
   * @return {string}
   */
  composeKey(name, ip) {
    return JSON.stringify([name, ip]);
  }

  /**
   * @param {string} string
   * @return {[string, string]} [name, ip]
   */
  decomposeKey(string) {
    return JSON.parse(string);
  }

  /**
   * @param {string} name
   * @param {string} ip
   */
  markOffline(name, ip) {
    const service = this.getServiceWithMeta(name, ip);
    if (!service) return;

    service.isOnline = false;
  };
}
