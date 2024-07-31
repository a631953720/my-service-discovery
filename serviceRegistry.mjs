import { mockHeartbeatAPI, heartbeatAPI, isDateValid } from './helpers/index.mjs'

/**
 * @typedef {Map<string, ServiceWithMeta>} IPServiceMap
 */

/**
 * @typedef {{
 *   lastHeartbeatAt: Date;
 *   errorsCount: number;
 *   ip: string;
 *   name: string;
 * }} HeartbeatMetaWithIPAndName
 */

/**
 * @typedef {{
 *   ip: string;
 *   isOnline: boolean;
 *   isHttps: boolean;
 * } & Record<string, any>} Meta
 */

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
    this.lastHeartbeatAt = new Date();
    this.errorsCount = 0;
  }

  toJSON() {
    return {
      name: this.name,
      ip: this.ip,
      isOnline: this.isOnline,
      isHttps: this.isHttps,
    }
  }

  /**
   * @return {HeartbeatMetaWithIPAndName}
   */
  getHeartbeatMetaWithIPAndName() {
    return {
      ip: this.ip,
      name: this.name,
      lastHeartbeatAt: this.lastHeartbeatAt,
      errorsCount: this.errorsCount,
    }
  }

  /**
   * @param {Partial<Pick<HeartbeatMetaWithIPAndName, 'errorsCount' | 'lastHeartbeatAt'>>} heartbeatMeta
   */
  updateHeartbeatMeta(heartbeatMeta) {
    if (heartbeatMeta.lastHeartbeatAt && isDateValid(heartbeatMeta.lastHeartbeatAt)) {
      this.lastHeartbeatAt = heartbeatMeta.lastHeartbeatAt;
    }

    if (typeof heartbeatMeta.errorsCount === 'number') {
      this.errorsCount = heartbeatMeta.errorsCount;
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
  }

  /**
   * @param {string} name
   * @param {Omit<Meta, 'heartbeatMeta'>} meta
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
   * @return {HeartbeatMetaWithIPAndName[]}
   */
  getAllHeartbeatMeta() {
    const result = [];

    this.map.forEach((ipServiceMap) => {
      ipServiceMap.forEach((service) => {
        result.push(service.getHeartbeatMetaWithIPAndName());
      });
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
    const heartbeatMeta = service.getHeartbeatMetaWithIPAndName();

    if (!isAlive) {
      console.log(`${name}-${ip} heartbeat failed`);
      service.updateHeartbeatMeta({
        errorsCount: heartbeatMeta.errorsCount + 1,
      })
    } else {
      console.log(`${name}-${ip} update heartbeat date`);
      service.updateHeartbeatMeta({
        lastHeartbeatAt: new Date(),
        errorsCount: 0,
      });
    }
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
