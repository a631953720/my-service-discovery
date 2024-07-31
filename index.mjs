import express from 'express';
import { ServiceRegistry } from './serviceRegistry.mjs';

const serviceRegistry = new ServiceRegistry();

const app = express();
const port = 4000;

app.use(express.json());

app.post('/api/register', (req, res) => {
  const { ip, name, isHttps = false } = req.body;

  console.log('add services', ip, name);

  if (serviceRegistry.isLocked) {
    console.log('register locked');
    res.status(422).send('register locked');
    return;
  }
  serviceRegistry.register(name, { ip, isOnline: true, isHttps });
  serviceRegistry.heartbeat(name, ip);
  res.sendStatus(200);
});

app.get('/api/all-services', (_req, res) => {
  const services = serviceRegistry.getAllServicesWithMeta();
  const result = services.map((service) => service.toJSON());

  res.json(result);
})

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);

  const mileSeconds = 1000;
  // trigger all service heartbeat and check service heartbeats
  setInterval(async () => {
    const services = serviceRegistry.getAllServicesWithMeta();
    const promises = services.map(async ({ name, ip }) => {
      console.log(`${name} heartbeat success. ip: ${ip}`);
      return new Promise((resolve) => {
        try {
          serviceRegistry.heartbeat(name, ip);
        } catch {
          console.log(`${name}-${ip} heartbeat function has errors`);
        }
        resolve();
      });
    });

    await Promise.all(promises);

    const now = new Date();
    const heartbeatMetas = serviceRegistry.getAllHeartbeatMeta();

    heartbeatMetas.forEach(({ lastHeartbeatAt, composeKey, errorsCount }) => {
      const [name, ip] = serviceRegistry.decomposeKey(composeKey);
      // remove service when heartbeat failed 5 times
      if (errorsCount >= 5) {
        console.log(`${name}-${ip} removed`);
        serviceRegistry.removeServiceFromIPServiceMap(name, ip);
        return;
      }

      if (now.getTime() - lastHeartbeatAt.getTime() > 3 * mileSeconds) {
        serviceRegistry.markOffline(name, ip);
        console.log(`${name}-${ip} is offline`);
      }
    });

    console.log('check done');
  }, 3 * mileSeconds);
});
