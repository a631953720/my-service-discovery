import { ServiceRegistry } from './serviceRegistry.mjs';
import { mockHeartbeatAPI } from './helpers/index.mjs';

beforeEach(async () => {
  jest.useFakeTimers();
});

afterAll(async () => {
  jest.useRealTimers();
});

jest.mock('./helpers/index.mjs', () => {
  const originalModule = jest.requireActual('./helpers/index.mjs');
  return {
    ...originalModule,
    mockHeartbeatAPI: jest.fn(),
  };
});

describe('ServiceRegistry', () => {
  let serviceRegistry;

  beforeEach(() => {
    serviceRegistry = new ServiceRegistry(true); // 使用 mock 的情境
  });

  test('should register a service', () => {
    const serviceName = 'testService';
    const serviceMeta = { ip: '127.0.0.1', isOnline: true, isHttps: false };

    serviceRegistry.register(serviceName, serviceMeta);

    const service = serviceRegistry.getServiceWithMeta(serviceName, '127.0.0.1');
    expect(service).not.toBeNull();
    expect(service.name).toBe(serviceName);
    expect(service.ip).toBe(serviceMeta.ip);
    expect(service.isOnline).toBe(serviceMeta.isOnline);
    expect(service.isHttps).toBe(serviceMeta.isHttps);
  });

  test('should lock registration when locked', () => {
    serviceRegistry.isLocked = true;
    const serviceName = 'testService';
    const serviceMeta = { ip: '127.0.0.1', isOnline: true, isHttps: false };

    expect(() => {
      serviceRegistry.register(serviceName, serviceMeta);
    }).toThrow('register locked');
  });

  test('should handle heartbeat successfully', async () => {
    const serviceName = 'testService';
    const serviceMeta = { ip: '127.0.0.1', isOnline: true, isHttps: false };

    mockHeartbeatAPI.mockReturnValue(true);
    serviceRegistry.register(serviceName, serviceMeta);
    await serviceRegistry.heartbeat(serviceName, serviceMeta.ip);

    const heartbeatMeta = serviceRegistry.getAllHeartbeatMeta()[0];
    expect(heartbeatMeta).not.toBeNull();
    expect(heartbeatMeta.errorsCount).toBe(0);
  });

  test('should increase error count on heartbeat failure', async () => {
    const serviceName = 'testService';
    const serviceMeta = { ip: '127.0.0.1', isOnline: true, isHttps: false };

    mockHeartbeatAPI.mockReturnValue(false);
    serviceRegistry.register(serviceName, serviceMeta);
    await serviceRegistry.heartbeat(serviceName, serviceMeta.ip);

    const heartbeatMeta = serviceRegistry.getAllHeartbeatMeta()[0];
    expect(heartbeatMeta).not.toBeNull();
    expect(heartbeatMeta.errorsCount).toBe(1);
  });

  test('should mark service as offline after no heartbeat', async () => {
    jest.setSystemTime(new Date(2024, 0, 1)); // 設定現在的時間
    const serviceName = 'testService';
    const serviceMeta = { ip: '127.0.0.1', isOnline: true, isHttps: false };

    serviceRegistry.register(serviceName, serviceMeta);
    await serviceRegistry.heartbeat(serviceName, serviceMeta.ip);

    jest.setSystemTime(new Date(2024, 0, 2)); // 模擬一段時間後
    const heartbeatMetas = serviceRegistry.getAllHeartbeatMeta();

    heartbeatMetas.forEach(({ lastHeartbeatAt, ip, name }) => {
      if (Date.now() - new Date(lastHeartbeatAt).getTime() > 3000) {
        serviceRegistry.markOffline(name, ip);
      }
    });

    const service = serviceRegistry.getServiceWithMeta(serviceName, serviceMeta.ip);
    expect(service).not.toBeNull();
    expect(service.isOnline).toBe(false); // 服務應該被標記為離線
  });
});
